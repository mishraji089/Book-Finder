// BookFinder.jsx
// Single-file React application (default export) using Tailwind CSS for styling.
// Instructions:
// 1. Create a new Vite React app (recommended):
//    npm create vite@latest book-finder -- --template react
// 2. Install dependencies and Tailwind CSS (follow Tailwind docs for Vite + React).
// 3. Replace src/App.jsx with this file's contents (or import it).
// 4. Start dev server: npm install && npm run dev

import React, { useEffect, useState, useRef } from "react";

// Utility: debounce hook
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function BookFinder() {
  // Search state
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 400);

  // Filter state
  const [searchBy, setSearchBy] = useState("title"); // title, author, isbn, subject
  const [language, setLanguage] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [numFound, setNumFound] = useState(0);

  // Results
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const controllerRef = useRef(null);

  // Build Open Library query string. Uses search.json and supports fields like title=, author=, isbn=
  function buildUrl(q, pageNum = 1, pageLimit = 12) {
    const base = "https://openlibrary.org/search.json";
    if (!q) return null;

    const params = new URLSearchParams();

    // Choose param based on searchBy
    if (searchBy === "title") params.set("title", q);
    else if (searchBy === "author") params.set("author", q);
    else if (searchBy === "isbn") params.set("isbn", q);
    else if (searchBy === "subject") params.set("subject", q);
    else params.set("q", q);

    if (language) params.set("language", language);

    // 'page' is 1-indexed for the API; limit is 'limit' param
    params.set("page", String(pageNum));
    params.set("limit", String(pageLimit));

    // Year filtering is not a direct param for search.json; we'll fetch and filter client-side
    return `${base}?${params.toString()}`;
  }

  useEffect(() => {
    // Reset page when query type or limit changes
    setPage(1);
  }, [searchBy, limit, language]);

  useEffect(() => {
    async function fetchBooks() {
      setError(null);
      if (!debouncedQuery || debouncedQuery.trim().length === 0) {
        setResults([]);
        setNumFound(0);
        return;
      }

      const url = buildUrl(debouncedQuery.trim(), page, limit);
      if (!url) return;

      setLoading(true);
      if (controllerRef.current) controllerRef.current.abort();
      controllerRef.current = new AbortController();
      try {
        const res = await fetch(url, { signal: controllerRef.current.signal });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        let docs = data.docs || [];

        // Client-side year filtering (first_publish_year)
        if (yearFrom) {
          const yf = parseInt(yearFrom, 10);
          if (!isNaN(yf)) docs = docs.filter((d) => d.first_publish_year && d.first_publish_year >= yf);
        }
        if (yearTo) {
          const yt = parseInt(yearTo, 10);
          if (!isNaN(yt)) docs = docs.filter((d) => d.first_publish_year && d.first_publish_year <= yt);
        }

        setResults(docs);
        setNumFound(data.numFound || docs.length);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchBooks();
    // cleanup on unmount
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, [debouncedQuery, page, limit, searchBy, language, yearFrom, yearTo]);

  // Helpers
  function coverUrlFromDoc(doc, size = "M") {
    // Open Library provides cover_i
    if (doc.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-${size}.jpg`;
    // Fallback: use ISBN if present
    if (doc.isbn && doc.isbn.length) return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-${size}.jpg`;
    return null;
  }

  function handleResultClick(doc) {
    // open the book page on Open Library
    const key = doc.key || (doc.edition_key && doc.edition_key[0]);
    if (!key) return;
    const url = key.startsWith("/") ? `https://openlibrary.org${key}` : `https://openlibrary.org/books/${key}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const totalPages = Math.max(1, Math.ceil(numFound / limit));

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-800">Book Finder</h1>
          <p className="text-gray-600 mt-1">Search books from Open Library — tailored for Alex, the college student 📚</p>
        </header>

        <section className="bg-white p-4 rounded-2xl shadow-sm mb-6">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="flex-1">
              <label className="sr-only">Search books</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search by ${searchBy} (try "Introduction to Algorithms", "Tolkien", or an ISBN)}`}
                className="w-full rounded-xl border px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                aria-label="Search books"
              />
            </div>

            <div className="flex gap-2 items-center">
              <select
                value={searchBy}
                onChange={(e) => setSearchBy(e.target.value)}
                className="rounded-xl border px-3 py-2"
                aria-label="Search by">
                <option value="title">Title</option>
                <option value="author">Author</option>
                <option value="isbn">ISBN</option>
                <option value="subject">Subject</option>
              </select>

              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="rounded-xl border px-3 py-2"
                aria-label="Results per page">
                <option value={8}>8 / page</option>
                <option value={12}>12 / page</option>
                <option value={24}>24 / page</option>
              </select>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm">Language</label>
              <input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="e.g., eng, fre, spa"
                className="rounded-lg border px-2 py-1 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm">Year from</label>
              <input
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                placeholder="e.g., 1990"
                className="rounded-lg border px-2 py-1 text-sm w-28"
              />

              <label className="text-sm">to</label>
              <input
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
                placeholder="e.g., 2020"
                className="rounded-lg border px-2 py-1 text-sm w-28"
              />
            </div>

            <div className="text-right md:text-left">
              <p className="text-sm text-gray-500">Showing <strong>{results.length}</strong> of <strong>{numFound}</strong> results</p>
              <p className="text-xs text-gray-400">Tip: try broader queries if few results appear.</p>
            </div>
          </div>
        </section>

        <main>
          {loading && (
            <div className="text-center py-12">Loading results…</div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded">Error: {error}</div>
          )}

          {!loading && !error && results.length === 0 && debouncedQuery && (
            <div className="text-center py-12 text-gray-600">No results found. Try a different query.</div>
          )}

          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((doc) => (
              <article
                key={doc.key || Math.random()}
                className="bg-white rounded-2xl p-4 shadow hover:shadow-md transition cursor-pointer flex gap-4"
                onClick={() => handleResultClick(doc)}
                aria-label={`Open ${doc.title}`}
              >
                <div className="w-24 flex-shrink-0">
                  {coverUrlFromDoc(doc) ? (
                    // eslint-disable-next-line jsx-a11y/img-redundant-alt
                    <img src={coverUrlFromDoc(doc)} alt={`Cover of ${doc.title}`} className="rounded-lg h-32 w-24 object-cover" />
                  ) : (
                    <div className="rounded-lg h-32 w-24 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">No Cover</div>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{doc.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{(doc.author_name && doc.author_name.join(", ")) || "Unknown author"}</p>
                  <p className="text-sm text-gray-500 mt-2">{doc.first_publish_year ? `First published: ${doc.first_publish_year}` : "Publication year: N/A"}</p>

                  <div className="mt-3 text-xs text-gray-500 flex flex-wrap gap-2">
                    {doc.subject && doc.subject.slice(0, 6).map((s) => (
                      <span key={s} className="px-2 py-1 bg-gray-100 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>

                <div className="self-start">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResultClick(doc); }}
                    className="text-indigo-600 text-sm hover:underline"
                  >
                    View
                  </button>
                </div>
              </article>
            ))}
          </section>

          {/* Pagination */}
          {results.length > 0 && (
            <div className="mt-8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 rounded-lg border disabled:opacity-50"
                >Previous</button>

                <span className="text-sm">Page <strong>{page}</strong> of {totalPages}</span>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-2 rounded-lg border disabled:opacity-50"
                >Next</button>
              </div>

              <div className="text-sm text-gray-500">Showing {results.length} results on this page</div>
            </div>
          )}
        </main>

        <footer className="mt-12 text-center text-sm text-gray-500">
          Data from Open Library • Built for Alex — a college student who wants quick, flexible book searches.
        </footer>
      </div>
    </div>
  );
}
