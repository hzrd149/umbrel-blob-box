export function DangerZone() {
  return (
    <div class="card bg-base-100 shadow-md border-error">
      <div class="card-body">
        <h2 class="card-title text-2xl mb-4 text-error">Danger Zone</h2>

        <div class="space-y-4">
          <div>
            <h3 class="text-lg font-semibold mb-2">Reset Configuration</h3>
            <p class="text-sm text-base-content/70 mb-3">
              This will reset all settings to their default values and clear the
              whitelist.
            </p>
            <form method="POST" action="/admin/reset-config">
              <button
                type="submit"
                class="btn btn-error"
                onclick="return confirm('Are you sure you want to reset all configuration to defaults? This cannot be undone.')"
              >
                Reset to Defaults
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
