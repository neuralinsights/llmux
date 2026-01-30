{{/*
Expand the name of the chart.
*/}}
{{- define "llmux.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "llmux.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "llmux.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "llmux.labels" -}}
helm.sh/chart: {{ include "llmux.chart" . }}
{{ include "llmux.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "llmux.selectorLabels" -}}
app.kubernetes.io/name: {{ include "llmux.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "llmux.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "llmux.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Redis host
*/}}
{{- define "llmux.redisHost" -}}
{{- if .Values.redis.enabled }}
{{- printf "%s-redis-master" (include "llmux.fullname" .) }}
{{- else }}
{{- .Values.llmux.cache.redisHost | default "localhost" }}
{{- end }}
{{- end }}

{{/*
Redis URL
*/}}
{{- define "llmux.redisUrl" -}}
{{- if .Values.redis.enabled }}
{{- printf "redis://%s:6379" (include "llmux.redisHost" .) }}
{{- else }}
{{- .Values.llmux.cache.redisUrl | default "" }}
{{- end }}
{{- end }}
