"use client";

import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps): JSX.Element {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bgBase p-6 text-textPrimary">
        <h2 className="text-xl font-semibold">Critical application error</h2>
        <p className="max-w-md text-center text-sm text-textSecondary">
          {error.message || "A fatal error occurred while rendering the app."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black hover:bg-[#58c8ff]"
        >
          Reload app
        </button>
      </body>
    </html>
  );
}
