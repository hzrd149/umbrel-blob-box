import { GlobeAltIcon } from "./icons";

interface TorInfoBannerProps {
  hiddenServiceUrl: string;
}

export default function TorInfoBanner({
  hiddenServiceUrl,
}: TorInfoBannerProps) {
  return (
    <details class="group">
      <summary class="p-4 cursor-pointer hover:bg-base-200 transition-colors flex items-center gap-2">
        <GlobeAltIcon />
        <span class="text-info font-semibold">
          Tor Hidden Service Available
        </span>
      </summary>
      <div class="p-4 border-t border-base-300">
        <p class="text-sm text-base-content/70 mb-4">
          This Blossom server is accessible via Tor at the following .onion
          address:
        </p>
        <div class="flex items-center gap-2 justify-stretch">
          <code
            class="text-sm font-mono text-base-content break-all flex-1 select-all bg-base-200 rounded-lg p-2 border border-base-300"
            safe
          >
            {hiddenServiceUrl}
          </code>
          <button
            class="btn btn-primary"
            onclick={`navigator.clipboard.writeText('${hiddenServiceUrl}').then(() => {
                    const btn = event.target;
                    const orig = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => btn.textContent = orig, 2000);
                  })`}
          >
            Copy
          </button>
        </div>
        <p class="text-sm text-base-content/60 mt-3">
          Share this address to allow others to access the server through the
          Tor network.
        </p>
      </div>
    </details>
  );
}
