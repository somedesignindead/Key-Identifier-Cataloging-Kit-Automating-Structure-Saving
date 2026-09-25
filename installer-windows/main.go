package main

import (
	"archive/zip"
	"bytes"
	_ "embed"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

const (
	appName      = "Layer Export Helper"
	runValueName = "Layer Export Helper"
	protocolName = "layerexport"
)

//go:embed payload/runtime.zip
var runtimeZip []byte

//go:embed payload/gs10080w64.exe
var ghostscriptInstaller []byte

func messageBox(title, text string, flags uintptr) {
	user32 := syscall.NewLazyDLL("user32.dll")
	proc := user32.NewProc("MessageBoxW")

	titlePtr, _ := syscall.UTF16PtrFromString(title)
	textPtr, _ := syscall.UTF16PtrFromString(text)

	_, _, _ = proc.Call(
		0,
		uintptr(unsafe.Pointer(textPtr)),
		uintptr(unsafe.Pointer(titlePtr)),
		flags,
	)
}

func fail(err error) {
	messageBox(
		appName,
		"Ошибка установки:\n\n"+err.Error(),
		0x10,
	)

	os.Exit(1)
}

func runHidden(name string, args ...string) error {
	cmd := exec.Command(name, args...)

	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow: true,
	}

	output, err := cmd.CombinedOutput()

	if err != nil {
		text := strings.TrimSpace(
			string(output),
		)

		if text != "" {
			return fmt.Errorf(
				"%s: %w\n%s",
				name,
				err,
				text,
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

func safeExtractZip(data []byte, destination string) error {
	reader, err := zip.NewReader(
		bytes.NewReader(data),
		int64(len(data)),
	)
	if err != nil {
		return err
	}

	cleanDestination, err :=
		filepath.Abs(destination)
	if err != nil {
		return err
	}

	for _, file := range reader.File {
		target := filepath.Join(
			cleanDestination,
			file.Name,
		)

		cleanTarget, err :=
			filepath.Abs(target)
		if err != nil {
			return err
		}

		prefix :=
			cleanDestination +
				string(os.PathSeparator)

		if cleanTarget != cleanDestination &&
			!strings.HasPrefix(
				cleanTarget,
				prefix,
			) {
			return fmt.Errorf(
				"некорректный путь в архиве: %s",
				file.Name,
			)
		}

		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(
				cleanTarget,
				0755,
			); err != nil {
				return err
			}

			continue
		}

		if err := os.MkdirAll(
			filepath.Dir(cleanTarget),
			0755,
		); err != nil {
			return err
		}

		source, err := file.Open()
		if err != nil {
			return err
		}

		targetFile, err := os.OpenFile(
			cleanTarget,
			os.O_CREATE|
				os.O_TRUNC|
				os.O_WRONLY,
			0644,
		)
		if err != nil {
			_ = source.Close()
			return err
		}

		_, copyErr := io.Copy(
			targetFile,
			source,
		)

		closeTargetErr :=
			targetFile.Close()

		closeSourceErr :=
			source.Close()

		if copyErr != nil {
			return copyErr
		}

		if closeTargetErr != nil {
			return closeTargetErr
		}

		if closeSourceErr != nil {
			return closeSourceErr
		}
	}

	return nil
}

func regAdd(
	key string,
	valueName string,
	value string,
) error {
	args := []string{
		"add",
		key,
	}

	if valueName == "" {
		args = append(
			args,
			"/ve",
		)
	} else {
		args = append(
			args,
			"/v",
			valueName,
		)
	}

	args = append(
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

	if err := regAdd(
		root,
		"",
		"URL:Layer Export Helper",
	); err != nil {
		return err
	}

	if err := regAdd(
		root,
		"URL Protocol",
		"",
	); err != nil {
		return err
	}

	if err := regAdd(
		root+`\DefaultIcon`,
		"",
		`"`+launcher+`",0`,
	); err != nil {
		return err
	}

	command :=
		`"` +
			launcher +
			`" "%1"`

	return regAdd(
		root+`\shell\open\command`,
		"",
		command,
	)
}

func registerAutoStart(
	launcher string,
) error {
	return regAdd(
		`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`,
		runValueName,
		`"`+launcher+`"`,
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
		[]byte(config),
		0644,
	)
}

func ghostscriptInstalled() bool {
	roots := []string{
		os.Getenv("ProgramW6432"),
		os.Getenv("ProgramFiles"),
		os.Getenv("ProgramFiles(x86)"),
	}

	seen := map[string]bool{}

	for _, root := range roots {
		if root == "" ||
			seen[root] {
			continue
		}

		seen[root] = true

		gsRoot :=
			filepath.Join(
				root,
				"gs",
			)

		entries, err :=
			os.ReadDir(
				gsRoot,
			)

		if err != nil {
			continue
		}

		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}

			candidate :=
				filepath.Join(
					gsRoot,
					entry.Name(),
					"bin",
					"gswin64c.exe",
				)

			if _, err := os.Stat(
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

	if err := os.WriteFile(
		installer,
		ghostscriptInstaller,
		0755,
	); err != nil {
		return err
	}

	/*
	 * Ghostscript installer requires elevation.
	 * PowerShell Start-Process -Verb RunAs triggers
	 * the normal Windows UAC prompt.
	 */
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

	/*
	 * Ghostscript намеренно не удаляем:
	 * это отдельный системный пакет и он может
	 * использоваться другими программами.
	 */
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
		if err := uninstall(
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

	killExistingLauncher()

	if err := os.RemoveAll(
		installDir,
	); err != nil {
		fail(err)
	}

	if err := os.MkdirAll(
		installDir,
		0755,
	); err != nil {
		fail(err)
	}

	if err := safeExtractZip(
		runtimeZip,
		installDir,
	); err != nil {
		fail(err)
	}

	if err := writeLauncherConfig(
		installDir,
	); err != nil {
		fail(err)
	}

	launcher :=
		filepath.Join(
			installDir,
			"LayerExportLauncher.exe",
		)

	if err := registerProtocol(
		launcher,
	); err != nil {
		fail(err)
	}

	if err := registerAutoStart(
		launcher,
	); err != nil {
		fail(err)
	}

	if err := installGhostscript(); err != nil {
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

	if err := cmd.Start(); err != nil {
		fail(
			fmt.Errorf(
				"Helper установлен, но launcher не запустился: %w",
				err,
			),
		)
	}

	messageBox(
		appName,
		"Установка завершена.\n\nLayer Export Helper запущен и будет стартовать вместе с Windows.",
		0x40,
	)
}
