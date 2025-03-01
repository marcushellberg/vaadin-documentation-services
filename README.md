# Vaadin Documentation Assistant

This project provides a complete solution for ingesting, indexing, and retrieving Vaadin documentation through semantic search. It consists of two main components that work together to make Vaadin documentation easily accessible to developers and IDE assistants.

## Project Components

### 1. Documentation Ingestion Pipeline (`docs-ingestion/`)

The ingestion pipeline handles the process of extracting, processing, and indexing Vaadin documentation:

- Clones or pulls the latest Vaadin documentation from GitHub
- Parses and processes AsciiDoc files with custom front matter
- Implements a hierarchical chunking strategy for optimal retrieval
- Generates embeddings using OpenAI's text-embedding-3-small model
- Stores embeddings and metadata in Pinecone vector database
- Supports incremental updates to keep documentation current

### 2. MCP Server (`mcp-server/`)

The Model Context Protocol (MCP) server provides a standardized interface for accessing the indexed documentation:

- Enables semantic search of Vaadin documentation
- Integrates with IDE assistants through the Model Context Protocol
- Provides control over search parameters (results count, token limits)
- Runs as a standalone service that communicates via stdio

## How It Works

1. The ingestion pipeline processes Vaadin documentation and stores it in a Pinecone vector database
2. The MCP server connects to the same Pinecone database to retrieve relevant documentation
3. IDE assistants and tools can query the MCP server to get contextual Vaadin documentation

## Prerequisites

- [Bun](https://bun.sh/) runtime
- OpenAI API key (for embeddings)
- Pinecone API key and index

## Quick Start

1. Set up environment variables in both components:
   ```bash
   # In docs-ingestion directory
   cp .env.example .env
   # Edit .env with your API keys

   # In mcp-server directory
   cp .env.example .env
   # Edit .env with your API keys
   ```

2. Run the ingestion pipeline:
   ```bash
   cd docs-ingestion
   ./run.sh ingest
   ```

3. Start the MCP server:
   ```bash
   cd mcp-server
   ./start-server.sh
   ```

4. Integrate with your IDE by adding the MCP server to your MCP settings file.

## Deployment Options

Both components can be deployed together or independently:

- **Combined deployment**: Run both components on the same machine, sharing configuration
- **Split deployment**: Run the ingestion pipeline periodically on one machine, and the MCP server continuously on another

## Available Tools

The MCP server provides the following tool:

### search_vaadin_docs

Search Vaadin documentation for relevant information.

**Parameters:**
- `query` (required): The search query or question about Vaadin
- `max_results` (optional): Maximum number of results to return (default: 5)
- `max_tokens` (optional): Maximum number of tokens to return (default: 1500)

## Maintenance

- Use the provided scripts to manage the services:
  - `start-server.sh`, `stop-server.sh`, `restart-server.sh`
  - `server-status.sh`, `view-logs.sh`, `clean-logs.sh`
- Set up a cron job using `update-daily.sh` to keep documentation current

## For More Information

See the individual README files in each component directory for detailed information:
- [Documentation Ingestion Pipeline](docs-ingestion/README.md)
- [MCP Server](mcp-server/README.md)

## License

[MIT](docs-ingestion/LICENSE)
