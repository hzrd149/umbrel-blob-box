import { UploadIcon } from "../../../components/icons";

interface FileUploadProps {
  currentPath: string;
}

export default function FileUpload({ currentPath }: FileUploadProps) {
  return (
    <div class="mt-8 bg-base-100 border border-base-300 rounded-box p-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="flex p-2 items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-content">
          <UploadIcon />
        </div>
        <div>
          <h3 class="font-semibold text-base-content">Upload Files</h3>
          <p class="text-sm text-base-content/70">
            Upload files to{" "}
            {currentPath === "/" ? "root directory" : currentPath}
          </p>
        </div>
      </div>

      <form
        action="/api/upload"
        method="POST"
        enctype="multipart/form-data"
        class="space-y-4"
      >
        <input type="hidden" name="path" value={currentPath} />

        <div class="form-control">
          <label class="label">
            <span class="label-text">Choose files</span>
          </label>
          <input
            type="file"
            name="files"
            multiple
            class="file-input file-input-bordered file-input-primary w-full"
            required
          />
          <label class="label">
            <span class="label-text-alt">
              Select one or more files to upload
            </span>
          </label>
        </div>

        <div class="flex gap-2">
          <button type="submit" class="btn btn-primary">
            <UploadIcon />
            Upload Files
          </button>
          <button type="reset" class="btn btn-ghost">
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}
