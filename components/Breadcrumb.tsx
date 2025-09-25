interface BreadcrumbProps {
  path: string;
}

export default function Breadcrumb({ path }: BreadcrumbProps) {
  const segments = path.split("/").filter(Boolean);

  return (
    <div class="breadcrumbs text-sm bg-base-200 p-4 rounded-box border border-base-300">
      <ul>
        <li>
          <a href="/" class="flex items-center gap-2 hover:text-primary">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9,22 9,12 15,12 15,22" />
            </svg>
            Home
          </a>
        </li>

        {segments.map((segment, index) => {
          const pathUpToSegment = "/" + segments.slice(0, index + 1).join("/");
          const searchParams = new URLSearchParams();
          searchParams.set("path", pathUpToSegment);
          const href = `/?${searchParams.toString()}`;

          return (
            <li>
              <a href={href} class="hover:text-primary" safe>
                {segment}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
