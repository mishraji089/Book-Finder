
import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";

// Debounce hook
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function BookFinder() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 400);

  const [searchBy, setSearchBy] = useState("title");
  const [language, setLanguage] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [numFound, setNumFound] = useState(0);

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const controllerRef = useRef(null);

  function buildUrl(q, pageNum = 1, pageLimit = 12) {
    const base = "https://openlibrary.org/search.json";
    if (!q) return null;

    const params = new URLSearchParams();
    if (searchBy === "title") params.set("title", q);
    else if (searchBy === "author") params.set("author", q);
    else if (searchBy === "isbn") params.set("isbn", q);
    else if (searchBy === "subject") params.set("subject", q);
    else params.set("q", q);

    if (language) params.set("language", language);

    params.set("page", String(pageNum));
    params.set("limit", String(pageLimit));

    return `${base}?${params.toString()}`;
  }

  useEffect(() => {
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
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchBooks();
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, [debouncedQuery, page, limit, searchBy, language, yearFrom, yearTo]);

  function coverUrlFromDoc(doc, size = "M") {
    if (doc.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-${size}.jpg`;
    if (doc.isbn && doc.isbn.length) return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-${size}.jpg`;
    return null;
  }

  function handleResultClick(doc) {
    const key = doc.key || (doc.edition_key && doc.edition_key[0]);
    if (!key) return;
    const url = key.startsWith("/") ? `https://openlibrary.org${key}` : `https://openlibrary.org/books/${key}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const totalPages = Math.max(1, Math.ceil(numFound / limit));

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-indigo-700 tracking-tight">Book Finder</h1>
          <p className="text-gray-600 mt-2 text-lg">Search millions of books with Open Library 📚</p>
        </header>

        <section className="bg-white/70 backdrop-blur rounded-3xl shadow-lg p-6 md:p-8 mb-10">
          <div className="flex flex-col md:flex-row gap-4 md:items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search by ${searchBy}`}
              className="flex-1 rounded-2xl border px-5 py-3 shadow focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

            <div className="flex gap-2">
              <select
                value={searchBy}
                onChange={(e) => setSearchBy(e.target.value)}
                className="rounded-xl border px-3 py-2 shadow-sm">
                <option value="title">Title</option>
                <option value="author">Author</option>
                <option value="isbn">ISBN</option>
                <option value="subject">Subject</option>
              </select>

              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="rounded-xl border px-3 py-2 shadow-sm">
                <option value={8}>8 / page</option>
                <option value={12}>12 / page</option>
                <option value={24}>24 / page</option>
              </select>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex gap-2 items-center">
              <label className="text-sm text-gray-700">Language</label>
              <input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="eng, fre, spa"
                className="rounded-lg border px-3 py-1 text-sm"
              />
            </div>

            <div className="flex gap-2 items-center">
              <label className="text-sm text-gray-700">Year</label>
              <input
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                placeholder="from"
                className="rounded-lg border px-2 py-1 text-sm w-24"
              />
              <span>-</span>
              <input
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
                placeholder="to"
                className="rounded-lg border px-2 py-1 text-sm w-24"
              />
            </div>

            <p className="text-sm text-gray-600 text-right md:text-left">Showing {results.length} / {numFound} results</p>
          </div>
        </section>

        <main>
          {loading && <div className="text-center py-12 text-indigo-600 animate-pulse">Loading…</div>}
          {error && <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl">Error: {error}</div>}
          {!loading && !error && results.length === 0 && debouncedQuery && (
            <div className="text-center py-12 text-gray-500">No results found.</div>
          )}

          <motion.section layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {results.map((doc) => (
              <motion.article
                key={doc.key || Math.random()}
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-3xl p-5 shadow-md hover:shadow-xl transition cursor-pointer flex flex-col"
                onClick={() => handleResultClick(doc)}
              >
                {coverUrlFromDoc(doc) ? (
                  <img src={coverUrlFromDoc(doc)} alt={doc.title} className="rounded-xl h-56 w-full object-cover mb-4" />
                ) : (
                  <div className="rounded-xl h-56 w-full bg-gray-100 flex items-center justify-center text-gray-400 mb-4">No Cover</div>
                )}

                <h3 className="font-semibold text-lg text-gray-800 line-clamp-2">{doc.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{doc.author_name?.join(", ") || "Unknown author"}</p>
                <p className="text-sm text-gray-500 mt-2">{doc.first_publish_year ? `Published: ${doc.first_publish_year}` : "Year: N/A"}</p>

                {doc.subject && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {doc.subject.slice(0, 4).map((s) => (
                      <span key={s} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs">{s}</span>
                    ))}
                  </div>
                )}

                <button
                  onClick={(e) => { e.stopPropagation(); handleResultClick(doc); }}
                  className="mt-auto self-start text-indigo-600 hover:text-indigo-800 text-sm font-medium mt-4"
                >View →</button>
              </motion.article>
            ))}
          </motion.section>

          {results.length > 0 && (
            <div className="mt-10 flex justify-between items-center">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-xl bg-indigo-100 text-indigo-700 disabled:opacity-50"
              >Previous</button>

              <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-xl bg-indigo-100 text-indigo-700 disabled:opacity-50"
              >Next</button>
            </div>
          )}
        </main>

        <footer className="mt-16 text-center text-sm text-gray-500">
          Data from Open Library • Built for Alex 🎓
        </footer>
      </div>
    </div>
  );
}
