import type { AppConfig } from "../../../services/config";

interface GeneralSettingsProps {
  config: AppConfig;
}

export function GeneralSettings({ config }: GeneralSettingsProps) {
  return (
    <div class="card bg-base-100 shadow-md">
      <div class="card-body">
        <h2 class="card-title text-2xl mb-4">General Settings</h2>

        <form method="POST" action="/admin/update-settings" class="space-y-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">Max File Size (MB)</span>
            </label>
            <input
              type="number"
              name="maxFileSize"
              value={Math.round(
                (config.maxFileSize || 0) / (1024 * 1024),
              ).toString()}
              min="1"
              max="1000"
              class="input input-bordered w-full"
              placeholder="100"
            />
            <label class="label">
              <span class="label-text-alt">
                Maximum size allowed for file uploads
              </span>
            </label>
          </div>

          <div class="form-control">
            <label class="cursor-pointer label justify-start gap-4">
              <input
                type="checkbox"
                name="allowAnonymous"
                class="checkbox checkbox-primary"
                checked={config.allowAnonymous}
              />
              <span class="label-text font-semibold">
                Allow Anonymous Uploads
              </span>
            </label>
            <label class="label">
              <span class="label-text-alt">
                When enabled, users can upload without being whitelisted
              </span>
            </label>
          </div>

          <div class="card-actions justify-end">
            <button type="submit" class="btn btn-primary">
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
