package main

import (
	"encoding/json"
)

func wrapOutput(command string, stdout, stderr []byte, exitCode int) map[string]any {
	meta := map[string]any{
		"cli":      "helios-opencli",
		"exitCode": exitCode,
		"upstream": "opencli",
	}
	if len(stderr) > 0 {
		meta["stderr"] = truncate(string(stderr), 4000)
	}

	if exitCode != 0 {
		errMsg := string(bytesTrim(stderr))
		if errMsg == "" {
			errMsg = string(bytesTrim(stdout))
		}
		if errMsg == "" {
			errMsg = "opencli failed"
		}
		return map[string]any{
			"ok":      false,
			"command": command,
			"error":   truncate(errMsg, 2000),
			"meta":    meta,
		}
	}

	data := parseData(stdout)
	return map[string]any{
		"ok":      true,
		"command": command,
		"data":    data,
		"meta":    meta,
	}
}

func parseData(stdout []byte) any {
	raw := bytesTrim(stdout)
	if len(raw) == 0 {
		return map[string]any{}
	}
	var v any
	if err := json.Unmarshal(raw, &v); err == nil {
		return v
	}
	return map[string]any{"raw": string(raw)}
}

func bytesTrim(b []byte) []byte {
	i, j := 0, len(b)
	for i < j && (b[i] == ' ' || b[i] == '\n' || b[i] == '\r' || b[i] == '\t') {
		i++
	}
	for j > i && (b[j-1] == ' ' || b[j-1] == '\n' || b[j-1] == '\r' || b[j-1] == '\t') {
		j--
	}
	return b[i:j]
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
