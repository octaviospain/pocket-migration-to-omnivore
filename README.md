# Pocket to Omnivore Import Script

This Node.js script imports your Pocket bookmarks to Omnivore using the official [@omnivore-app/api](https://github.com/omnivore-app/omnivore-api) client library.

## Features

- **Import articles** from Pocket CSV export to Omnivore
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
```

### Examples

```bash
# Basic import - respects Pocket's archive status for all articles
node import-pocket-to-omnivore.js ~/Downloads/pocket-export.csv

# Only archive articles that have tags (keeps untagged articles unread)
node import-pocket-to-omnivore.js --unread_untagged ~/Downloads/pocket-export.csv

# With inline API key and server URL for self-hosted Omnivore for self-hosted Omnivore with custom archiving
OMNIVORE_API_KEY="your-key" OMNIVORE_BASE_URL="https://omnivore.example.com" \
  node import-pocket-to-omnivore.js --unread_untagged pocket-export.csv

# Show help
node import-pocket-to-omnivore.js --help
```

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
- **Keeps unread** all articles without tags, even if they were archived in Pocket
- Useful if you want to review/re-tag untagged articles before archiving

## Expected CSV Format

The script expects a CSV file with the following columns (standard Pocket export format):

- `title` - Article title
- `url` - Article URL (required)
- `tags` - Pipe-separated tags (e.g., "tech|programming|nodejs")
- `time_added` - Unix timestamp when article was saved
- `status` - Article status ("archive" for archived articles, "unread" for unread)

## Real-Time Progress Display

The script shows a beautiful real-time progress bar:

```
[PROGRESS] ████████████░░░░░░ 75% (150/200) Processing: How to Build Better APIs...
```

- **Dynamic updates** - single line that updates in place (no console spam)
- **Shows current article** being processed
- **Percentage and count** - clear progress indication
- **Graceful fallback** - works in all terminal types

## Error Handling & Fail-Fast

When an error occurs, the script **stops immediately** and shows detailed diagnostics:

```
[ERROR] IMPORT STOPPED: Row 1247: GraphQL error: Invalid URL format
[ERROR] Failed at row 1247:
[ERROR]   Title: "Broken Article"  
[ERROR]   URL: "not-a-valid-url"
[ERROR]   Tags: "tech|programming"
[ERROR]   Status: "archive"
[ERROR] 
Progress before failure: 1246/1246 articles imported successfully
```

This helps you:
- **Identify problematic entries** quickly
- **Fix CSV issues** before running the full import
- **Resume from where you left off** after fixing problems

## Final Statistics

After successful completion, you'll see comprehensive statistics:

```
📊 Final Statistics:
  ✅ Total articles processed: 1250/1250
  🏷️  Articles with tags: 892
  📦 Articles archived: 445
  📖 Articles kept unread: 805
  ⏭️  Archived→Unread (untagged): 67
```

The last line only appears when using `--unread_untagged` and shows how many articles were kept unread despite being archived in Pocket.

## Script Behavior Details

### Tag Processing
- Tags are converted to Omnivore labels with the default orange color (`#EF8C43`)
- Tags that look like timestamps (pure numbers) are ignored
- Empty or whitespace-only tags are skipped
- Tags are split by the pipe character (`|`)

### Rate Limiting
- 200ms delay between API requests to avoid rate limiting
- Progress updates in real-time without flooding logs
- Configurable delay via the `DELAY_BETWEEN_REQUESTS` constant

### Logging Colors
The script provides color-coded logging:
- **🔵 INFO** - General information and progress
- **🟢 SUCCESS** - Successful operations
- **🟡 WARNING** - Non-fatal issues
- **🔴 ERROR** - Errors and failures

## Troubleshooting

### Common Issues

1. **"OMNIVORE_API_KEY environment variable is required"**
   - Make sure you've set the API key: `export OMNIVORE_API_KEY="your-key"`

2. **"CSV file not found"**
   - Check the file path is correct
   - Ensure the file exists and is readable

3. **GraphQL or Network errors**
   - Check your internet connection
   - Verify your API key is valid and not expired
   - Ensure the base URL is correct for self-hosted instances

4. **"Row X: Invalid URL format"**
   - Some URLs in your CSV might be malformed
   - Edit the CSV to fix the problematic URL
   - The script will resume from where it left off

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - feel free to modify and distribute as needed.