package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

const (
	launcherAddress  = "127.0.0.1:47830"
	converterAddress = "127.0.0.1:47831"
)

var (
	logFile       *os.File
	converterLock sync.Mutex
)

type config struct {
	NodePath   string
	ServerPath string
	WorkDir    string
}

func dataDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	switch runtime.GOOS {
	case "darwin":
		return filepath.Join(
			home,
			"Library",
			"Application Support",
			"Layer Export",
		), nil

	case "windows":
		local := os.Getenv("LOCALAPPDATA")
		if local == "" {
			return "", fmt.Errorf("LOCALAPPDATA не задан")
		}

		return filepath.Join(local, "Layer Export"), nil

	default:
		if xdg := os.Getenv("XDG_DATA_HOME"); xdg != "" {
			return filepath.Join(xdg, "layer-export"), nil
		}

		return filepath.Join(
			home,
			".local",
			"share",
			"layer-export",
		), nil
	}
}

func setupLogging(dir string) error {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	path := filepath.Join(dir, "launcher.log")

	file, err := os.OpenFile(
		path,
		os.O_CREATE|os.O_WRONLY|os.O_APPEND,
		0644,
	)
	if err != nil {
		return err
	}

	logFile = file
	log.SetOutput(file)
	log.SetFlags(log.Ldate | log.Ltime | log.Lmicroseconds)

	return nil
}

func readConfig(dir string) (config, error) {
	path := filepath.Join(dir, "launcher.conf")

	file, err := os.Open(path)
	if err != nil {
		return config{}, err
	}
	defer file.Close()

	values := map[string]string{}

	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}

		values[strings.TrimSpace(key)] = strings.TrimSpace(value)
	}

	if err := scanner.Err(); err != nil {
		return config{}, err
	}

	cfg := config{
		NodePath:   values["node-path"],
		ServerPath: values["server-path"],
		WorkDir:    values["work-dir"],
	}

	if cfg.NodePath == "" {
		return config{}, fmt.Errorf("в launcher.conf нет node-path")
	}

	if cfg.ServerPath == "" {
		return config{}, fmt.Errorf("в launcher.conf нет server-path")
	}

	if cfg.WorkDir == "" {
		cfg.WorkDir = filepath.Dir(filepath.Dir(cfg.ServerPath))
	}

	return cfg, nil
}

func converterRunning() bool {
	conn, err := net.DialTimeout(
		"tcp",
		converterAddress,
		300*time.Millisecond,
	)

	if err != nil {
		return false
	}

	_ = conn.Close()
	return true
}

func startConverter(dir string) (bool, error) {
	converterLock.Lock()
	defer converterLock.Unlock()

	if converterRunning() {
		return false, nil
	}

	cfg, err := readConfig(dir)
	if err != nil {
		return false, err
	}

	if _, err := os.Stat(cfg.NodePath); err != nil {
		return false, fmt.Errorf(
			"Node не найден: %s: %w",
			cfg.NodePath,
			err,
		)
	}

	if _, err := os.Stat(cfg.ServerPath); err != nil {
		return false, fmt.Errorf(
			"server.mjs не найден: %s: %w",
			cfg.ServerPath,
			err,
		)
	}

	converterLogPath := filepath.Join(dir, "converter.log")

	converterLog, err := os.OpenFile(
		converterLogPath,
		os.O_CREATE|os.O_WRONLY|os.O_APPEND,
		0644,
	)
	if err != nil {
		return false, err
	}

	cmd := exec.Command(cfg.NodePath, cfg.ServerPath)
	cmd.Dir = cfg.WorkDir
	cmd.Stdout = converterLog
	cmd.Stderr = converterLog

	if err := cmd.Start(); err != nil {
		_ = converterLog.Close()
		return false, err
	}

	log.Printf("Converter запущен, PID %d", cmd.Process.Pid)

	go func() {
		err := cmd.Wait()

		if err != nil {
			log.Printf(
				"Converter PID %d завершился: %v",
				cmd.Process.Pid,
				err,
			)
		} else {
			log.Printf(
				"Converter PID %d завершился",
				cmd.Process.Pid,
			)
		}

		_ = converterLog.Close()
	}()

	return true, nil
}

func allowedOrigin(origin string) bool {
	switch origin {
	case "":
		return true
	case "null":
		return true
	case "https://www.figma.com":
		return true
	case "https://figma.com":
		return true
	default:
		return false
	}
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			if !allowedOrigin(origin) {
				http.Error(
					w,
					`{"error":"origin not allowed"}`,
					http.StatusForbidden,
				)
				return
			}

			if origin != "" {
				w.Header().Set(
					"Access-Control-Allow-Origin",
					origin,
				)
			}

			w.Header().Set(
				"Access-Control-Allow-Methods",
				"GET, OPTIONS",
			)

			w.Header().Set(
				"Access-Control-Allow-Headers",
				"Content-Type",
			)

			w.Header().Set(
				"Access-Control-Allow-Private-Network",
				"true",
			)

			w.Header().Set("Cache-Control", "no-store")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		},
	)
}

func jsonResponse(
	w http.ResponseWriter,
	status int,
	value any,
) {
	w.Header().Set(
		"Content-Type",
		"application/json; charset=utf-8",
	)

	w.WriteHeader(status)

	_ = json.NewEncoder(w).Encode(value)
}

func existingLauncherRunning() bool {
	conn, err := net.DialTimeout(
		"tcp",
		launcherAddress,
		300*time.Millisecond,
	)
	if err != nil {
		return false
	}

	_ = conn.Close()
	return true
}

func requestExistingLauncherStart() {
	client := &http.Client{
		Timeout: 3 * time.Second,
	}

	response, err := client.Get(
		"http://" + launcherAddress + "/start",
	)
	if err != nil {
		return
	}

	_ = response.Body.Close()
}

func main() {
	/*
	 * URL protocol / repeated manual start:
	 * if launcher is already listening on 47830,
	 * ask that instance to start converter and exit.
	 */
	if existingLauncherRunning() {
		requestExistingLauncherStart()
		return
	}

	dir, err := dataDir()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	if err := setupLogging(dir); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	defer logFile.Close()

	log.Printf(
		"Layer Export Launcher запущен: %s/%s",
		runtime.GOOS,
		runtime.GOARCH,
	)

	mux := http.NewServeMux()

	mux.HandleFunc(
		"/health",
		func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet {
				jsonResponse(
					w,
					http.StatusMethodNotAllowed,
					map[string]any{
						"ok": false,
					},
				)
				return
			}

			jsonResponse(
				w,
				http.StatusOK,
				map[string]any{
					"ok":        true,
					"platform":  runtime.GOOS,
					"converter": converterRunning(),
				},
			)
		},
	)

	mux.HandleFunc(
		"/start",
		func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet {
				jsonResponse(
					w,
					http.StatusMethodNotAllowed,
					map[string]any{
						"ok": false,
					},
				)
				return
			}

			started, err := startConverter(dir)

			if err != nil {
				log.Printf(
					"Ошибка запуска converter: %v",
					err,
				)

				jsonResponse(
					w,
					http.StatusInternalServerError,
					map[string]any{
						"ok":    false,
						"error": err.Error(),
					},
				)
				return
			}

			jsonResponse(
				w,
				http.StatusOK,
				map[string]any{
					"ok":      true,
					"started": started,
				},
			)
		},
	)

	server := &http.Server{
		Addr:              launcherAddress,
		Handler:           cors(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf(
		"Launcher слушает http://%s",
		launcherAddress,
	)

	err = server.ListenAndServe()

	if err != nil && err != http.ErrServerClosed {
		if err != io.EOF {
			log.Fatalf("HTTP server: %v", err)
		}
	}
}
