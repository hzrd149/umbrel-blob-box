interface DocumentProps {
  title: string;
  children: JSX.Element;
}

export default function Document({ title, children }: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title safe>{title}</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
