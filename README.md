![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/octaviospain/pocket-migration-to-omnivore/.github%2Fworkflows%2Fci.yml?logo=github)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=octaviospain_pocket-migration-to-omnivore&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=octaviospain_pocket-migration-to-omnivore)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=octaviospain_pocket-migration-to-omnivore&metric=bugs)](https://sonarcloud.io/summary/new_code?id=octaviospain_pocket-migration-to-omnivore)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=octaviospain_pocket-migration-to-omnivore&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=octaviospain_pocket-migration-to-omnivore)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=octaviospain_pocket-migration-to-omnivore&metric=coverage)](https://sonarcloud.io/summary/new_code?id=octaviospain_pocket-migration-to-omnivore)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=octaviospain_pocket-migration-to-omnivore&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=octaviospain_pocket-migration-to-omnivore)

# Pocket to Omnivore Import Script

This Node.js script imports your Pocket bookmarks to Omnivore using the official
[@omnivore-app/api](https://github.com/omnivore-app/omnivore-api) client
library.

## Features

- **Import articles** from Pocket CSV export to Omnivore
- **URL validation** - automatically checks if links are still alive and skips
  dead ones
- **Preserve tags** as Omnivore labels with custom colors
- **Archive articles** based on their Pocket status
- **Flexible archiving options** - respect Pocket status or customize behavior
- **Preserve timestamps** when articles were originally saved
- **Real-time progress bar** with dynamic updates (Gradle-style)
- **Fail-fast behavior** - stops immediately on errors with detailed diagnostics
- **Error handling** with detailed logging and progress tracking
- **Rate limiting** to avoid overwhelming the API
- **Color-coded logging** for better visibility

## Prerequisites

- Node.js 18 or later
- An Omnivore account and API key
- A CSV export from Pocket

## Setup

1. **Clone or download** this script to your local machine

2. **Install dependencies**:

    ```bash
    npm install
    ```

3. **Get your Omnivore API key**:

    - Go to your Omnivore instance (e.g., https://omnivore.app)
    - Navigate to Settings → API Keys
    - Create a new API key and copy it

4. **Export your Pocket data**:
    - Go to [Pocket Export](https://getpocket.com/export)
    - Download your bookmarks as a CSV file

## Configuration

Set your API key as an environment variable:

```bash
# For the current session
export OMNIVORE_API_KEY="your-api-key-here"

# Or add to your shell profile (.bashrc, .zshrc, etc.)
echo 'export OMNIVORE_API_KEY="your-api-key-here"' >> ~/.bashrc
```

**Optional**: If you're using a self-hosted Omnivore instance, set the base URL:

```bash
export OMNIVORE_BASE_URL="https://your-omnivore-instance.com"
```

## Usage

### Basic Usage

```bash
node import-pocket-to-omnivore.js path/to/your/pocket-export.csv
```

### Command Line Options

```bash
node import-pocket-to-omnivore.js [options] <csv_file_path>

Options:
  --unread_untagged    Don't archive articles without tags, even if marked as archived in Pocket
  --help, -h           Show help message

Note: The script automatically checks if URLs are still alive and skips dead links.
```

### Examples

```bash
# Basic import - respects Pocket's archive status for all articles
node import-pocket-to-omnivore.js ~/Downloads/pocket-export.csv

# Only archive articles that have tags (keeps untagged articles unread)
node import-pocket-to-omnivore.js --unread_untagged ~/Downloads/pocket-export.csv

# With inline API key and server URL for self-hosted Omnivore
OMNIVORE_API_KEY="your-key" OMNIVORE_BASE_URL="https://omnivore.example.com" \
  node import-pocket-to-omnivore.js --unread_untagged pocket-export.csv

# Show help
node import-pocket-to-omnivore.js --help
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run integration test
npm run test:integration
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code with Prettier
npm run format

# Check if code is properly formatted
npm run format:check

# Run all quality checks (lint + format + test)
npm run precommit
```

### Development Scripts

```bash
# Start the import script with file watching
npm run dev

# Run specific import
npm run import -- path/to/file.csv --unread_untagged
```

## URL Validation

The script **automatically validates all URLs** before importing them to
Omnivore:

### ✅ **What Gets Checked**

- HTTP/HTTPS accessibility using HEAD requests
- Response status codes (200-399 considered "alive")
- Network connectivity and DNS resolution
- Server timeouts (configurable, default 10 seconds)

### 🔍 **URL Checking Process**

1. For each article URL, a HEAD request is made
2. URLs returning 2xx or 3xx status codes are considered alive
3. Dead URLs (4xx, 5xx, network errors, timeouts) are automatically skipped
4. Skipped URLs are logged with the reason (e.g., "HTTP 404", "ENOTFOUND",
   "Timeout")
5. Final statistics show how many URLs were skipped

### 📊 **Benefits**

- **Cleaner library**: Only working links are imported
- **Faster imports**: No time wasted on dead links
- **Better experience**: Avoid broken bookmarks in Omnivore
- **Detailed reporting**: Know exactly which links failed and why

## Archiving Behavior

The script provides two archiving modes to suit different workflows:

### 🔸 **Default Mode** (Standard Behavior)

```bash
node import-pocket-to-omnivore.js pocket-export.csv
```

- **Archives** all articles marked as `status="archive"` in Pocket
- **Keeps unread** all articles marked as `status="unread"` in Pocket
- This preserves your exact Pocket organization

### 🔸 **Unread Untagged Mode** (Selective Archiving)

```bash
node import-pocket-to-omnivore.js --unread_untagged pocket-export.csv
```

- **Archives** only articles that have both:
    - `status="archive"` in Pocket AND
    - At least one tag assigned
- **Keeps unread** all articles without tags, even if they were archived in
  Pocket
- Useful if you want to review/re-tag untagged articles before archiving

## Expected CSV Format

The script expects a CSV file with the following columns (standard Pocket export
format):

- `title` - Article title
- `url` - Article URL (required)
- `tags` - Pipe-separated tags (e.g., "tech|programming|nodejs")
- `time_added` - Unix timestamp when article was saved
- `status` - Article status ("archive" for archived articles, "unread" for
  unread)

## Project Structure

```
pocket-to-omnivore-importer/
├── src/                          # Source modules
│   ├── logger.js                 # Logging and progress display
│   ├── csv-parser.js             # CSV parsing and validation
│   ├── tag-processor.js          # Tag processing utilities
│   ├── importer.js               # Main import logic with URL checking
│   └── cli.js                    # Command line interface
├── tests/                        # Test suite
│   ├── *.test.js                 # Unit and integration tests
├── import-pocket-to-omnivore.js  # Main entry point
├── eslint.config.js              # ESLint configuration
├── .prettierrc.json              # Prettier configuration
└── package.json                  # Dependencies and scripts
```

## Code Quality Tools

This project uses industry-standard tools for code quality:

- **ESLint**: JavaScript linting with modern ES2022+ rules
- **Prettier**: Code formatting with consistent style
- **Node.js Test Runner**: Built-in testing framework (Node 18+)

### ESLint Configuration

- Modern flat config format
- Import/export validation
- Node.js specific rules
- Prettier integration to avoid conflicts
- Test-specific rules for test files

### Prettier Configuration

- Single quotes, semicolons
- 100 character line length
- 4-space indentation
- Trailing commas avoided
- Special formatting for JSON and Markdown

## Error Handling & Fail-Fast

The script distinguishes between different types of issues:

### 🛑 **Fatal Errors** (Stop Import)

- Invalid CSV format or structure
- Malformed URLs (not fixable)
- Missing required environment variables
- File system errors

### ⏭️ **Skippable Issues** (Continue Import)

- Dead URLs (404, network errors, timeouts)
- Unreachable servers

### 📊 **Example Output**

```
[INFO] Starting import process...
[WARNING] Row 15: Skipping dead URL (HTTP 404): https://old-blog.example.com/post
[WARNING] Row 23: Skipping dead URL (ENOTFOUND): https://defunct-site.invalid
[ERROR] IMPORT STOPPED: Row 47: Invalid URL format

Progress before failure: 45/46 articles imported successfully
Final Statistics:
  ✅ Total articles processed: 45/50
  ⏭️  Articles skipped (dead URLs): 4
  🏷️  Articles with tags: 38
  📦 Articles archived: 22
```

## Performance Considerations

- **URL checking timeout**: 10 seconds per URL (configurable)
- **Rate limiting**: 200ms delay between requests (configurable)
- **Concurrent checking**: URLs are checked sequentially to avoid overwhelming
  servers
- **Progress tracking**: Real-time progress bar with current article being
  processed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run quality checks: `npm run precommit`
5. Submit a pull request

### Development Workflow

```bash
# Install dependencies
npm install

# Make your changes
# ...

# Check code quality
npm run lint
npm run format:check
npm test

# Fix any issues
npm run lint:fix
npm run format

# Commit your changes
git commit -m "Your descriptive commit message"
```

## License

GPL-3.0 License
