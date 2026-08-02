package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const defaultCommunityMcpRegistryBaseURL = "https://registry.modelcontextprotocol.io"

type communityMcpCatalogResponse struct {
	Servers  []communityMcpServerSummary `json:"servers"`
	Metadata struct {
		NextCursor string `json:"nextCursor,omitempty"`
		Count      int    `json:"count,omitempty"`
	} `json:"metadata,omitempty"`
}

type communityMcpServerSummary struct {
	Name          string `json:"name"`
	Title         string `json:"title,omitempty"`
	Description   string `json:"description,omitempty"`
	Version       string `json:"version,omitempty"`
	Transport     string `json:"transport,omitempty"`
	InstallHint   string `json:"installHint,omitempty"`
	RepositoryURL string `json:"repositoryUrl,omitempty"`
	WebsiteURL    string `json:"websiteUrl,omitempty"`
	Status        string `json:"status,omitempty"`
	IsLatest      bool   `json:"isLatest,omitempty"`
}

type upstreamMcpCatalogResponse struct {
	Servers []struct {
		Server struct {
			Name        string `json:"name"`
			Title       string `json:"title"`
			Description string `json:"description"`
			Version     string `json:"version"`
			Repository  *struct {
				URL string `json:"url"`
			} `json:"repository"`
			WebsiteURL string `json:"websiteUrl"`
			Remotes    []struct {
				Type string `json:"type"`
				URL  string `json:"url"`
			} `json:"remotes"`
			Packages []struct {
				RegistryType string `json:"registryType"`
				Identifier   string `json:"identifier"`
				Version      string `json:"version"`
				RuntimeHint  string `json:"runtimeHint"`
				Transport    *struct {
					Type string `json:"type"`
				} `json:"transport"`
				RuntimeArguments []struct {
					Value string `json:"value"`
					Type  string `json:"type"`
				} `json:"runtimeArguments"`
				EnvironmentVariables []struct {
					Name       string `json:"name"`
					IsSecret   bool   `json:"isSecret"`
					IsRequired bool   `json:"isRequired"`
				} `json:"environmentVariables"`
			} `json:"packages"`
		} `json:"server"`
		Meta struct {
			Official struct {
				Status   string `json:"status"`
				IsLatest bool   `json:"isLatest"`
			} `json:"io.modelcontextprotocol.registry/official"`
		} `json:"_meta"`
	} `json:"servers"`
	Metadata struct {
		NextCursor string `json:"nextCursor"`
		Count      int    `json:"count"`
	} `json:"metadata"`
}

func (s *Server) handleListCommunityMcpServers(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	upstreamURL, err := s.communityMcpRegistryURL(query)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_QUERY", err.Error())
		return
	}

	client := &http.Client{Timeout: 12 * time.Second}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, upstreamURL.String(), nil)
	if err != nil {
		writeError(w, http.StatusBadGateway, "UPSTREAM_FAILED", err.Error())
		return
	}

	resp, err := client.Do(req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "UPSTREAM_FAILED", fmt.Sprintf("community MCP registry unreachable: %v", err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		writeError(w, http.StatusBadGateway, "UPSTREAM_FAILED", fmt.Sprintf("community MCP registry status %d", resp.StatusCode))
		return
	}

	var upstream upstreamMcpCatalogResponse
	if err := json.NewDecoder(resp.Body).Decode(&upstream); err != nil {
		writeError(w, http.StatusBadGateway, "UPSTREAM_FAILED", fmt.Sprintf("invalid community MCP registry response: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, s.normalizeCommunityMcpCatalog(upstream))
}

func (s *Server) communityMcpRegistryURL(query url.Values) (*url.URL, error) {
	base := strings.TrimSpace(s.communityMcpRegistryBaseURL)
	if base == "" {
		base = strings.TrimSpace(os.Getenv("HELIOS_MCP_REGISTRY_BASE_URL"))
	}
	if base == "" {
		base = defaultCommunityMcpRegistryBaseURL
	}
	parsed, err := url.Parse(strings.TrimRight(base, "/"))
	if err != nil {
		return nil, fmt.Errorf("invalid MCP registry base URL: %w", err)
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + "/v0.1/servers"

	params := url.Values{}
	if search := strings.TrimSpace(query.Get("search")); search != "" {
		params.Set("search", search)
	}
	if cursor := strings.TrimSpace(query.Get("cursor")); cursor != "" {
		params.Set("cursor", cursor)
	}
	limit := strings.TrimSpace(query.Get("limit"))
	if limit == "" {
		limit = "12"
	}
	if _, err := strconv.Atoi(limit); err != nil {
		return nil, fmt.Errorf("limit must be an integer")
	}
	params.Set("limit", limit)
	params.Set("version", "latest")
	parsed.RawQuery = params.Encode()
	return parsed, nil
}

func (s *Server) normalizeCommunityMcpCatalog(upstream upstreamMcpCatalogResponse) communityMcpCatalogResponse {
	out := communityMcpCatalogResponse{}
	out.Metadata.NextCursor = upstream.Metadata.NextCursor
	out.Metadata.Count = upstream.Metadata.Count
	out.Servers = make([]communityMcpServerSummary, 0, len(upstream.Servers))

	for _, item := range upstream.Servers {
		server := item.Server
		summary := communityMcpServerSummary{
			Name:          strings.TrimSpace(server.Name),
			Title:         strings.TrimSpace(server.Title),
			Description:   strings.TrimSpace(server.Description),
			Version:       strings.TrimSpace(server.Version),
			RepositoryURL: "",
			WebsiteURL:    strings.TrimSpace(server.WebsiteURL),
			Status:        strings.TrimSpace(item.Meta.Official.Status),
			IsLatest:      item.Meta.Official.IsLatest,
		}
		if server.Repository != nil {
			summary.RepositoryURL = strings.TrimSpace(server.Repository.URL)
		}
		if summary.Title == "" {
			summary.Title = summary.Name
		}
		summary.Transport = summarizeCommunityTransport(server.Remotes, server.Packages)
		summary.InstallHint = summarizeCommunityInstallHint(server.Remotes, server.Packages)
		out.Servers = append(out.Servers, summary)
	}

	return out
}

func summarizeCommunityTransport(remotes []struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}, packages []struct {
	RegistryType string `json:"registryType"`
	Identifier   string `json:"identifier"`
	Version      string `json:"version"`
	RuntimeHint  string `json:"runtimeHint"`
	Transport    *struct {
		Type string `json:"type"`
	} `json:"transport"`
	RuntimeArguments []struct {
		Value string `json:"value"`
		Type  string `json:"type"`
	} `json:"runtimeArguments"`
	EnvironmentVariables []struct {
		Name       string `json:"name"`
		IsSecret   bool   `json:"isSecret"`
		IsRequired bool   `json:"isRequired"`
	} `json:"environmentVariables"`
}) string {
	if len(packages) > 0 {
		if transport := packages[0].Transport; transport != nil && strings.TrimSpace(transport.Type) != "" {
			return strings.TrimSpace(transport.Type)
		}
		if hint := strings.TrimSpace(packages[0].RuntimeHint); hint != "" {
			return hint
		}
	}
	if len(remotes) > 0 && strings.TrimSpace(remotes[0].Type) != "" {
		return strings.TrimSpace(remotes[0].Type)
	}
	return "unknown"
}

func summarizeCommunityInstallHint(remotes []struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}, packages []struct {
	RegistryType string `json:"registryType"`
	Identifier   string `json:"identifier"`
	Version      string `json:"version"`
	RuntimeHint  string `json:"runtimeHint"`
	Transport    *struct {
		Type string `json:"type"`
	} `json:"transport"`
	RuntimeArguments []struct {
		Value string `json:"value"`
		Type  string `json:"type"`
	} `json:"runtimeArguments"`
	EnvironmentVariables []struct {
		Name       string `json:"name"`
		IsSecret   bool   `json:"isSecret"`
		IsRequired bool   `json:"isRequired"`
	} `json:"environmentVariables"`
}) string {
	if len(packages) > 0 {
		pkg := packages[0]
		parts := []string{}
		hint := strings.TrimSpace(pkg.RuntimeHint)
		identifier := strings.TrimSpace(pkg.Identifier)
		version := strings.TrimSpace(pkg.Version)
		switch hint {
		case "npx":
			if identifier != "" {
				parts = append(parts, "npx", "-y", identifier)
				if version != "" {
					parts[len(parts)-1] = parts[len(parts)-1] + "@" + version
				}
			}
		case "uvx":
			if identifier != "" {
				parts = append(parts, "uvx", identifier)
				if version != "" {
					parts[len(parts)-1] = parts[len(parts)-1] + "@" + version
				}
			}
		default:
			if hint != "" {
				parts = append(parts, hint)
			}
			if identifier != "" {
				parts = append(parts, identifier)
			}
			if version != "" && len(parts) > 0 {
				parts[len(parts)-1] = parts[len(parts)-1] + "@" + version
			}
		}
		if hint != "npx" && hint != "uvx" && len(pkg.RuntimeArguments) > 0 {
			args := make([]string, 0, len(pkg.RuntimeArguments))
			for _, arg := range pkg.RuntimeArguments {
				value := strings.TrimSpace(arg.Value)
				if value != "" {
					args = append(args, value)
				}
			}
			if len(args) > 0 {
				parts = append(parts, strings.Join(args, " "))
			}
		}
		if len(parts) > 0 {
			hintLine := strings.Join(parts, " ")
			if len(pkg.EnvironmentVariables) > 0 {
				envNames := make([]string, 0, len(pkg.EnvironmentVariables))
				for _, env := range pkg.EnvironmentVariables {
					name := strings.TrimSpace(env.Name)
					if name != "" {
						envNames = append(envNames, name)
					}
				}
				if len(envNames) > 0 {
					hintLine += " | env: " + strings.Join(envNames, ", ")
				}
			}
			return hintLine
		}
	}
	if len(remotes) > 0 {
		remote := remotes[0]
		if strings.TrimSpace(remote.Type) != "" && strings.TrimSpace(remote.URL) != "" {
			return strings.TrimSpace(remote.Type) + " · " + strings.TrimSpace(remote.URL)
		}
		if strings.TrimSpace(remote.URL) != "" {
			return strings.TrimSpace(remote.URL)
		}
	}
	return "registry listing"
}
