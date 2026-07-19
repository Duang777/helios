# Backend Agent Guide

## Purpose

The backend is the Helios workflow kernel. It owns workflow contracts, compilation, execution, audit state, and evidence records.

## Current Status

- Building MVP in-memory API.
- Compiler uses deterministic templates for local demos.
- Runtime executes DAG nodes with dependency checks and scoped agent context.

## Rules

- Keep exported domain types stable and JSON-friendly.
- Validate request bodies in `internal/httpapi`.
- Keep business defaults in `internal/compiler`.
- Keep execution semantics in `internal/runtime`.
- Add unit tests for compiler and runtime behavior before changing logic.

