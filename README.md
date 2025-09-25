# umbrel-blob-box

A Blossom-compatible blob storage server with Nostr authentication.

## Features

- **BUD-02 Compliant**: Implements the Blossom specification for blob upload and management
- **Nostr Authentication**: Uses Nostr events (kind 24242) for authorization
- **Pubkey Whitelisting**: Only whitelisted pubkeys can upload/delete blobs
- **Organized Storage**: Uploads stored in `/blossom-uploads/<pubkey>/filename.ext` structure
- **Admin Dashboard**: Web interface for managing configuration and whitelist

## Installation

To install dependencies:

```bash
bun install
```

## Configuration

The server uses configuration stored in `data/config/app-config.json`:

```json
{
  "whitelist": [
    "266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5"
  ],
  "maxFileSize": 104857600,
  "allowAnonymous": false
}
```

## Running

To run the server:

```bash
bun run index.ts
```

## API Endpoints

### Blossom Endpoints (BUD-02)

- **PUT /upload** - Upload blob with Nostr authorization
- **GET /list/{pubkey}** - List blobs uploaded by pubkey
- **DELETE /{sha256}** - Delete blob with Nostr authorization
- **GET /{sha256}[.ext]** - Retrieve blob by hash

### Admin Endpoints

- **GET /admin** - Admin dashboard (requires HTTP Basic auth)
- **POST /admin/add-whitelist** - Add pubkey to whitelist
- **POST /admin/remove-whitelist** - Remove pubkey from whitelist

## Authorization Format

Blossom operations require a Nostr authorization event (kind 24242) passed in the `Authorization` header:

```
Authorization: Nostr <base64-encoded-event>
```

The event must:

- Have `kind: 24242`
- Include a `t` tag with the operation type (`upload`, `list`, `delete`)
- For upload/delete: include `x` tag(s) with the SHA256 hash(es)
- Be signed by a whitelisted pubkey

## Example Authorization Event

```json
{
  "id": "...",
  "pubkey": "266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5",
  "kind": 24242,
  "content": "Upload bitcoin.pdf",
  "created_at": 1708773959,
  "tags": [
    ["t", "upload"],
    ["x", "b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553"],
    ["expiration", "1708858680"]
  ],
  "sig": "..."
}
```

This project was created using `bun init` in bun v1.2.21. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
