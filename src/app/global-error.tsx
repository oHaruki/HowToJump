"use client";

import "./globals.css";

/** Shown when the root layout itself fails, so it brings its own html and body. */
export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <main className="wrap">
          <div className="view">
            <div className="section-head">
              <h1>Something went wrong</h1>
              <p className="lede">The site could not be loaded. Try again in a minute.</p>
            </div>
            <div className="row">
              <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
                Try again
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
