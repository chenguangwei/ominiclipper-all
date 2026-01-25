# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-01-25 17:43

### Added
- **Internationalization (i18n)**: Added support for English (en) and Chinese (zh) languages.
- **Settings**: Added language switcher in Settings dialog.
- **AI Models**: Added support for **BAAI/bge-m3** embedding model for high-precision semantic search.
- **AI Models**: Added **OpenRouter** support with customizable API keys.
- **AI Models**: Added Model Selection dropdown in Settings (e.g., GPT-4o, Claude 3.5, Gemini).

### Changed
- **Settings**: Improved UI for AI Configuration section.
- **Vector Search**: Modularized vector service to support dynamic model switching.
- **Vector Search**: Fixed `vectorService.checkMissing` error in backend.
