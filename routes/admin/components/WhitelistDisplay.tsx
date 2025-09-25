import { WhitelistItem } from "./WhitelistItem";

interface WhitelistDisplayProps {
  whitelist: string[];
}

export function WhitelistDisplay({ whitelist }: WhitelistDisplayProps) {
  return (
    <div>
      <h3 class="text-lg font-semibold mb-3">
        Current Whitelist ({whitelist.length} keys)
      </h3>

      {whitelist.length === 0 ? (
        <div class="text-center py-8 text-base-content/60">
          <p class="text-lg">No public keys in whitelist</p>
          <p class="text-sm">
            Add public keys above to allow specific users to upload
          </p>
        </div>
      ) : (
        <div class="space-y-2">
          {whitelist.map((pubkey) => (
            <WhitelistItem pubkey={pubkey} />
          ))}
        </div>
      )}
    </div>
  );
}
