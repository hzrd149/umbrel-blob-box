export function AddWhitelistForm() {
  return (
    <div class="mb-6">
      <h3 class="text-lg font-semibold mb-3">Add Public Key</h3>
      <form method="POST" action="/admin/add-whitelist" class="flex gap-2">
        <input
          type="text"
          name="pubkey"
          placeholder="Enter public key (hex, npub, or nprofile)"
          class="input input-bordered flex-1"
          title="Public key can be 64-character hex, npub, or nprofile format"
          required
        />
        <button type="submit" class="btn btn-primary">
          Add
        </button>
      </form>
    </div>
  );
}
