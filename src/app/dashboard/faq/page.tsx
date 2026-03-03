"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FAQ {
  id: number;
  question: string;
  answer: string;
  match_keywords: string;
  times_used: number;
  created_at: string;
}

export default function FAQPage() {
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;

  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const [form, setForm] = useState({ question: "", answer: "", match_keywords: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchFAQs = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API}/api/faqs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch FAQs");
      const data = await res.json();
      setFaqs(data);
    } catch {
      setError("Unable to load FAQs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "loading" || !token) return;
    fetchFAQs();
  }, [token, status]);

  const handleAdd = async () => {
    if (!form.question || !form.answer || !form.match_keywords) {
      setFormError("All fields are required.");
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      const res = await fetch(`${API}/api/faqs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to create FAQ");
      setForm({ question: "", answer: "", match_keywords: "" });
      setFormSuccess(true);
      setTimeout(() => setFormSuccess(false), 3000);
      await fetchFAQs();
    } catch {
      setFormError("Failed to save FAQ.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setDeleting(id);
      await fetch(`${API}/api/faqs/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setFaqs((prev) => prev.filter((f) => f.id !== id));
    } catch {
      setError("Failed to delete FAQ.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">FAQ Management</h1>
        <span className="text-sm text-muted-foreground">{faqs.length} entries</span>
      </div>

      {/* Add FAQ Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add New FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Question"
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
          />
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Answer"
            rows={3}
            value={form.answer}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Keywords (comma-separated, e.g. price,cost,how much)"
            value={form.match_keywords}
            onChange={(e) => setForm({ ...form, match_keywords: e.target.value })}
          />
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          {formSuccess && <p className="text-sm text-green-500">FAQ added successfully!</p>}
          <button
            onClick={handleAdd}
            disabled={saving}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add FAQ"}
          </button>
        </CardContent>
      </Card>

      {/* FAQ List */}
      {loading ? (
        <p className="text-muted-foreground">Loading FAQs...</p>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-red-500">{error}</CardContent>
        </Card>
      ) : faqs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No FAQs yet. Add one above to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq) => (
            <Card key={faq.id}>
              <CardContent className="pt-4 space-y-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <p className="font-medium text-sm">{faq.question}</p>
                    <p className="text-sm text-muted-foreground">{faq.answer}</p>
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-xs text-muted-foreground">
                        Keywords: <span className="font-mono">{faq.match_keywords}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Used {faq.times_used}x
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(faq.id)}
                    disabled={deleting === faq.id}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 shrink-0"
                  >
                    {deleting === faq.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}