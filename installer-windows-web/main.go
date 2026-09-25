package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

const (
	appName      = "Layer Export Helper"
	runValueName = "Layer Export Helper"
	protocolName = "layerexport"

	nodeURL =
		"https://nodejs.org/dist/v24.18.0/node-v24.18.0-win-x64.zip"

	nodeSHA256 =
		"0ae68406b42d7725661da979b1403ec9926da205c6770827f33aac9d8f26e821"

	gsURL =
		"https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/gs10080/gs10080w64.exe"

	gsSHA256 =
		"52a91b8bf09298788d7a57b9206127026c23eacd75405f0a131e26dc381dce50"
)

//go:embed payload/runtime.zip
var runtimeZip []byte

func messageBox(
	title,
	text string,
	flags uintptr,
) {
	user32 :=
		syscall.NewLazyDLL(
			"user32.dll",
		)

	proc :=
		user32.NewProc(
			"MessageBoxW",
		)

	titlePtr, _ :=
		syscall.UTF16PtrFromString(
			title,
		)

	textPtr, _ :=
		syscall.UTF16PtrFromString(
			text,
		)

	_, _, _ =
		proc.Call(
			0,
			uintptr(
				unsafe.Pointer(
					textPtr,
				),
			),
			uintptr(
				unsafe.Pointer(
					titlePtr,
				),
			),
			flags,
		)
}

func fail(err error) {
	messageBox(
		appName,
		"Ошибка установки:\n\n"+
			err.Error(),
		0x10,
	)

	os.Exit(1)
}

func runHidden(
	name string,
	args ...string,
) error {
	cmd :=
		exec.Command(
			name,
			args...,
		)

	cmd.SysProcAttr =
		&syscall.SysProcAttr{
			HideWindow:
				true,
		}

	output, err :=
		cmd.CombinedOutput()

	if err != nil {
		detail :=
			strings.TrimSpace(
				string(output),
			)

		if detail != "" {
			return fmt.Errorf(
				"%s: %w\n%s",
				name,
				err,
				detail,
			)
		}

		return fmt.Errorf(
			"%s: %w",
			name,
			err,
		)
	}

	return nil
}

func killExistingLauncher() {
	_ = runHidden(
		"taskkill.exe",
		"/IM",
		"LayerExportLauncher.exe",
		"/F",
	)
}

func safeExtractZip(
	data []byte,
	destination string,
) error {
	reader, err :=
		zip.NewReader(
			bytes.NewReader(
				data,
			),
			int64(
				len(data),
			),
		)

	if err != nil {
		return err
	}

	root, err :=
		filepath.Abs(
			destination,
		)

	if err != nil {
		return err
	}

	for _, file :=
		range reader.File {
		target :=
			filepath.Join(
				root,
				file.Name,
			)

		target, err =
			filepath.Abs(
				target,
			)

		if err != nil {
			return err
		}

		if target != root &&
			!strings.HasPrefix(
				target,
				root+
					string(
						os.PathSeparator,
					),
			) {
			return fmt.Errorf(
				"некорректный путь в ZIP: %s",
				file.Name,
			)
		}

		if file.FileInfo().IsDir() {
			if err :=
				os.MkdirAll(
					target,
					0755,
				); err != nil {
				return err
			}

			continue
		}

		if err :=
			os.MkdirAll(
				filepath.Dir(
					target,
				),
				0755,
			); err != nil {
			return err
		}

		source, err :=
			file.Open()

		if err != nil {
			return err
		}

		output, err :=
			os.OpenFile(
				target,
				os.O_CREATE|
					os.O_TRUNC|
					os.O_WRONLY,
				0644,
			)

		if err != nil {
			_ = source.Close()
			return err
		}

		_, copyErr :=
			io.Copy(
				output,
				source,
			)

		outputErr :=
			output.Close()

		sourceErr :=
			source.Close()

		if copyErr != nil {
			return copyErr
		}

		if outputErr != nil {
			return outputErr
		}

		if sourceErr != nil {
			return sourceErr
		}
	}

	return nil
}

func downloadVerified(
	url,
	expectedSHA256 string,
) ([]byte, error) {
	client :=
		&http.Client{
			Timeout:
				15 * time.Minute,
		}

	request, err :=
		http.NewRequest(
			http.MethodGet,
			url,
			nil,
		)

	if err != nil {
		return nil, err
	}

	request.Header.Set(
		"User-Agent",
		"Layer-Export-Helper/0.2",
	)

	response, err :=
		client.Do(
			request,
		)

	if err != nil {
		return nil, err
	}

	defer response.Body.Close()

	if response.StatusCode <
		200 ||
		response.StatusCode >=
			300 {
		return nil, fmt.Errorf(
			"HTTP %d: %s",
			response.StatusCode,
			url,
		)
	}

	bytes, err :=
		io.ReadAll(
			response.Body,
		)

	if err != nil {
		return nil, err
	}

	hash :=
		sha256.Sum256(
			bytes,
		)

	actual :=
		hex.EncodeToString(
			hash[:],
		)

	if !strings.EqualFold(
		actual,
		expectedSHA256,
	) {
		return nil, fmt.Errorf(
			"SHA256 не совпал:\n%s\nожидался: %s\nполучен: %s",
			url,
			expectedSHA256,
			actual,
		)
	}

	return bytes, nil
}

func copyFile(
	source,
	target string,
) error {
	input, err :=
		os.Open(
			source,
		)

	if err != nil {
		return err
	}

	defer input.Close()

	if err :=
		os.MkdirAll(
			filepath.Dir(
				target,
			),
			0755,
		); err != nil {
		return err
	}

	output, err :=
		os.OpenFile(
			target,
			os.O_CREATE|
				os.O_TRUNC|
				os.O_WRONLY,
			0755,
		)

	if err != nil {
		return err
	}

	_, copyErr :=
		io.Copy(
			output,
			input,
		)

	closeErr :=
		output.Close()

	if copyErr != nil {
		return copyErr
	}

	return closeErr
}

func installNodeAndDependencies(
	installDir string,
) error {
	nodeZip, err :=
		downloadVerified(
			nodeURL,
			nodeSHA256,
		)

	if err != nil {
		return fmt.Errorf(
			"не удалось скачать Node.js: %w",
			err,
		)
	}

	tempDir, err :=
		os.MkdirTemp(
			"",
			"layer-export-node-*",
		)

	if err != nil {
		return err
	}

	defer os.RemoveAll(
		tempDir,
	)

	if err :=
		safeExtractZip(
			nodeZip,
			tempDir,
		); err != nil {
		return fmt.Errorf(
			"не удалось распаковать Node.js: %w",
			err,
		)
	}

	nodeRoot :=
		filepath.Join(
			tempDir,
			"node-v24.18.0-win-x64",
		)

	tempNode :=
		filepath.Join(
			nodeRoot,
			"node.exe",
		)

	npmCli :=
		filepath.Join(
			nodeRoot,
			"node_modules",
			"npm",
			"bin",
			"npm-cli.js",
		)

	if _, err :=
		os.Stat(
			tempNode,
		); err != nil {
		return fmt.Errorf(
			"node.exe не найден после распаковки: %w",
			err,
		)
	}

	if _, err :=
		os.Stat(
			npmCli,
		); err != nil {
		return fmt.Errorf(
			"npm-cli.js не найден после распаковки: %w",
			err,
		)
	}

	cmd :=
		exec.Command(
			tempNode,
			npmCli,
			"ci",
			"--omit=dev",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
		)

	cmd.Dir =
		installDir

	cmd.Env =
		append(
			os.Environ(),
			"PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1",
		)

	cmd.SysProcAttr =
		&syscall.SysProcAttr{
			HideWindow:
				true,
		}

	output, err :=
		cmd.CombinedOutput()

	if err != nil {
		return fmt.Errorf(
			"npm ci завершился с ошибкой: %w\n%s",
			err,
			strings.TrimSpace(
				string(output),
			),
		)
	}

	targetNode :=
		filepath.Join(
			installDir,
			"runtime",
			"node",
			"node.exe",
		)

	if err :=
		copyFile(
			tempNode,
			targetNode,
		); err != nil {
		return fmt.Errorf(
			"не удалось установить node.exe: %w",
			err,
		)
	}

	return nil
}

func regAdd(
	key,
	valueName,
	value string,
) error {
	args :=
		[]string{
			"add",
			key,
		}

	if valueName == "" {
		args =
			append(
				args,
				"/ve",
			)
	} else {
		args =
			append(
				args,
				"/v",
				valueName,
			)
	}

	args =
		append(
			args,
			"/t",
			"REG_SZ",
			"/d",
			value,
			"/f",
		)

	return runHidden(
		"reg.exe",
		args...,
	)
}

func registerProtocol(
	launcher string,
) error {
	root :=
		`HKCU\Software\Classes\` +
			protocolName

	if err :=
		regAdd(
			root,
			"",
			"URL:Layer Export Helper",
		); err != nil {
		return err
	}

	if err :=
		regAdd(
			root,
			"URL Protocol",
			"",
		); err != nil {
		return err
	}

	if err :=
		regAdd(
			root+
				`\DefaultIcon`,
			"",
			`"`+
				launcher+
				`",0`,
		); err != nil {
		return err
	}

	return regAdd(
		root+
			`\shell\open\command`,
		"",
		`"`+
			launcher+
			`" "%1"`,
	)
}

func registerAutoStart(
	launcher string,
) error {
	return regAdd(
		`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`,
		runValueName,
		`"`+
			launcher+
			`"`,
	)
}

func writeLauncherConfig(
	installDir string,
) error {
	node :=
		filepath.Join(
			installDir,
			"runtime",
			"node",
			"node.exe",
		)

	server :=
		filepath.Join(
			installDir,
			"converter",
			"server.mjs",
		)

	config :=
		"node-path=" +
			node +
			"\r\n" +
			"server-path=" +
			server +
			"\r\n" +
			"work-dir=" +
			installDir +
			"\r\n"

	return os.WriteFile(
		filepath.Join(
			installDir,
			"launcher.conf",
		),
		[]byte(
			config,
		),
		0644,
	)
}

func ghostscriptInstalled() bool {
	roots :=
		[]string{
			os.Getenv(
				"ProgramW6432",
			),
			os.Getenv(
				"ProgramFiles",
			),
			os.Getenv(
				"ProgramFiles(x86)",
			),
		}

	seen :=
		map[string]bool{}

	for _, root :=
		range roots {
		if root == "" ||
			seen[root] {
			continue
		}

		seen[root] =
			true

		entries, err :=
			os.ReadDir(
				filepath.Join(
					root,
					"gs",
				),
			)

		if err != nil {
			continue
		}

		for _, entry :=
			range entries {
			if !entry.IsDir() {
				continue
			}

			candidate :=
				filepath.Join(
					root,
					"gs",
					entry.Name(),
					"bin",
					"gswin64c.exe",
				)

			if _, err :=
				os.Stat(
					candidate,
				); err == nil {
				return true
			}
		}
	}

	return false
}

func installGhostscript() error {
	if ghostscriptInstalled() {
		return nil
	}

	bytes, err :=
		downloadVerified(
			gsURL,
			gsSHA256,
		)

	if err != nil {
		return fmt.Errorf(
			"не удалось скачать Ghostscript: %w",
			err,
		)
	}

	tempDir, err :=
		os.MkdirTemp(
			"",
			"layer-export-gs-*",
		)

	if err != nil {
		return err
	}

	defer os.RemoveAll(
		tempDir,
	)

	installer :=
		filepath.Join(
			tempDir,
			"gs10080w64.exe",
		)

	if err :=
		os.WriteFile(
			installer,
			bytes,
			0755,
		); err != nil {
		return err
	}

	script :=
		fmt.Sprintf(
			`$p = Start-Process -FilePath '%s' -ArgumentList '/S' -Verb RunAs -Wait -PassThru; exit $p.ExitCode`,
			strings.ReplaceAll(
				installer,
				"'",
				"''",
			),
		)

	return runHidden(
		"powershell.exe",
		"-NoProfile",
		"-ExecutionPolicy",
		"Bypass",
		"-Command",
		script,
	)
}

func uninstall(
	installDir string,
) error {
	killExistingLauncher()

	_ = runHidden(
		"reg.exe",
		"delete",
		`HKCU\Software\Classes\`+
			protocolName,
		"/f",
	)

	_ = runHidden(
		"reg.exe",
		"delete",
		`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`,
		"/v",
		runValueName,
		"/f",
	)

	return os.RemoveAll(
		installDir,
	)
}

func main() {
	localAppData :=
		os.Getenv(
			"LOCALAPPDATA",
		)

	if localAppData == "" {
		fail(
			fmt.Errorf(
				"Windows не передал LOCALAPPDATA",
			),
		)
	}

	installDir :=
		filepath.Join(
			localAppData,
			"Layer Export",
		)

	if len(os.Args) > 1 &&
		strings.EqualFold(
			os.Args[1],
			"/uninstall",
		) {
		if err :=
			uninstall(
				installDir,
			); err != nil {
			fail(err)
		}

		messageBox(
			appName,
			"Layer Export Helper удалён.",
			0x40,
		)

		return
	}

	messageBox(
		appName,
		"Будет установлен Layer Export Helper.\n\nВо время установки потребуется интернет. Для Ghostscript Windows один раз покажет запрос UAC.",
		0x40,
	)

	killExistingLauncher()

	if err :=
		os.RemoveAll(
			installDir,
		); err != nil {
		fail(err)
	}

	if err :=
		os.MkdirAll(
			installDir,
			0755,
		); err != nil {
		fail(err)
	}

	if err :=
		safeExtractZip(
			runtimeZip,
			installDir,
		); err != nil {
		fail(err)
	}

	if err :=
		installNodeAndDependencies(
			installDir,
		); err != nil {
		fail(err)
	}

	if err :=
		writeLauncherConfig(
			installDir,
		); err != nil {
		fail(err)
	}

	launcher :=
		filepath.Join(
			installDir,
			"LayerExportLauncher.exe",
		)

	if err :=
		registerProtocol(
			launcher,
		); err != nil {
		fail(err)
	}

	if err :=
		registerAutoStart(
			launcher,
		); err != nil {
		fail(err)
	}

	if err :=
		installGhostscript(); err != nil {
		fail(
			fmt.Errorf(
				"Helper установлен, но Ghostscript установить не удалось: %w",
				err,
			),
		)
	}

	cmd :=
		exec.Command(
			launcher,
		)

	cmd.SysProcAttr =
		&syscall.SysProcAttr{
			HideWindow:
				true,
		}

	if err :=
		cmd.Start(); err != nil {
		fail(
			fmt.Errorf(
				"Helper установлен, но launcher не запустился: %w",
				err,
			),
		)
	}

	messageBox(
		appName,
		"Установка завершена.\n\nLayer Export Helper запущен.",
		0x40,
	)
}
