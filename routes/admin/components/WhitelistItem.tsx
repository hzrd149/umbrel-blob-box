interface WhitelistItemProps {
  pubkey: string;
}

export function WhitelistItem({ pubkey }: WhitelistItemProps) {
  return (
    <div class="flex items-center gap-4 p-3 bg-base-200 rounded-lg">
      <code class="flex-1 text-sm font-mono break-all">{pubkey}</code>
      <form method="POST" action="/admin/remove-whitelist">
        <input type="hidden" name="pubkey" value={pubkey} />
        <button
          type="submit"
          class="btn btn-sm btn-error"
          onclick="return confirm('Are you sure you want to remove this public key from the whitelist?')"
        >
          Remove
        </button>
      </form>
    </div>
  );
}
