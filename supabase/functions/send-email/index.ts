// Supabase Edge Function: send-email
// データベースの通知トリガーから呼ばれ、Amazon SES でメールを送ります。
//
// 必要なシークレット（Supabase > Edge Functions > Secrets）:
//   EMAIL_SECRET          schema 実行後に private.app_config に入れた値と同じ文字列
//   SES_REGION            例: ap-northeast-1
//   SES_ACCESS_KEY_ID     ses:SendEmail 権限を持つ IAM ユーザーのキー
//   SES_SECRET_ACCESS_KEY 同上
//   MAIL_FROM             SES で認証済みの送信元（例: "TB Tasks <tasks@example.com>"）
//   APP_URL               公開したアプリの URL（例: https://tasks.example.com）
//   APP_NAME              メール件名に付ける名前（任意）
//
// JWT 検証は OFF にしてデプロイしてください（代わりに EMAIL_SECRET で保護）。

import { AwsClient } from "npm:aws4fetch@1.0.20";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const EMAIL_SECRET = env("EMAIL_SECRET");
const REGION = env("SES_REGION", "ap-northeast-1");
const MAIL_FROM = env("MAIL_FROM");
const APP_URL = env("APP_URL").replace(/\/$/, "");
const APP_NAME = env("APP_NAME", "Tasks");

const aws = new AwsClient({
  accessKeyId: env("SES_ACCESS_KEY_ID"),
  secretAccessKey: env("SES_SECRET_ACCESS_KEY"),
  region: REGION,
  service: "ses",
});

type Payload = {
  to: string;
  recipient: string | null;
  actor: string | null;
  kind: "assigned" | "comment" | "mention" | "completed" | "due_today" | "due_tomorrow";
  body: string | null;
  task_id: string;
  task_title: string | null;
  due_date: string | null;
  project_name: string | null;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function fmtDate(d: string | null) {
  if (!d) return "なし";
  const [y, m, day] = d.split("-").map(Number);
  const wd = "日月火水木金土"[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  return `${y}年${m}月${day}日(${wd})`;
}

function compose(p: Payload) {
  const title = p.task_title?.trim() || "(無題のタスク)";
  const actor = p.actor ?? "誰か";
  const link = `${APP_URL}/#/task/${p.task_id}`;
  let headline = "";
  let subject = "";
  switch (p.kind) {
    case "assigned":
      headline = `${actor}さんがあなたにタスクを割り当てました`;
      subject = `【割り当て】${title}`;
      break;
    case "comment":
      headline = `${actor}さんがコメントしました`;
      subject = `【コメント】${title}`;
      break;
    case "mention":
      headline = `${actor}さんがコメントであなたをメンションしました`;
      subject = `【メンション】${title}`;
      break;
    case "completed":
      headline = `${actor}さんがタスクを完了しました`;
      subject = `【完了】${title}`;
      break;
    case "due_today":
      headline = "今日が期限のタスクがあります";
      subject = `【今日期限】${title}`;
      break;
    case "due_tomorrow":
      headline = "明日が期限のタスクがあります";
      subject = `【明日期限】${title}`;
      break;
  }
  subject = `[${APP_NAME}] ${subject}`;

  const quote = (p.kind === "comment" || p.kind === "mention") && p.body ? p.body : "";
  const text = [
    `${p.recipient ?? ""}さん`,
    "",
    headline,
    "",
    `タスク: ${title}`,
    p.project_name ? `プロジェクト: ${p.project_name}` : "",
    `期限: ${fmtDate(p.due_date)}`,
    quote ? `\n--- コメント ---\n${quote}\n---------------` : "",
    "",
    `開く: ${link}`,
  ].filter((l) => l !== "").join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f6f6f7;font-family:-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;color:#1e1f21">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:10px;border:1px solid #e8e8ea">
<tr><td style="padding:20px 24px;border-bottom:1px solid #eee;font-weight:700;font-size:14px;color:#6d6e6f">${esc(APP_NAME)}</td></tr>
<tr><td style="padding:24px">
  <p style="margin:0 0 6px;font-size:14px;color:#6d6e6f">${esc(headline)}</p>
  <p style="margin:0 0 16px;font-size:20px;font-weight:700">${esc(title)}</p>
  <table cellpadding="0" cellspacing="0" style="font-size:14px;color:#1e1f21">
    ${p.project_name ? `<tr><td style="padding:3px 16px 3px 0;color:#6d6e6f">プロジェクト</td><td>${esc(p.project_name)}</td></tr>` : ""}
    <tr><td style="padding:3px 16px 3px 0;color:#6d6e6f">期限</td><td>${esc(fmtDate(p.due_date))}</td></tr>
  </table>
  ${quote ? `<div style="margin-top:16px;padding:12px 14px;background:#f6f6f7;border-radius:8px;font-size:14px;white-space:pre-wrap">${esc(quote)}</div>` : ""}
  <p style="margin:24px 0 0"><a href="${esc(link)}" style="display:inline-block;background:#f06a6a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:14px">タスクを開く</a></p>
</td></tr></table>
<p style="font-size:12px;color:#9ca0a4;margin-top:12px">通知メールは アプリの「設定」からオフにできます。</p>
</td></tr></table></body></html>`;

  return { subject, text, html };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!EMAIL_SECRET || req.headers.get("x-email-secret") !== EMAIL_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  let p: Payload;
  try {
    p = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  if (!p.to || !p.task_id) return new Response("Bad Request", { status: 400 });

  const { subject, text, html } = compose(p);
  const res = await aws.fetch(`https://email.${REGION}.amazonaws.com/v2/email/outbound-emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      FromEmailAddress: MAIL_FROM,
      Destination: { ToAddresses: [p.to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: text, Charset: "UTF-8" },
            Html: { Data: html, Charset: "UTF-8" },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("SES error", res.status, detail);
    return new Response(`SES error ${res.status}: ${detail}`, { status: 502 });
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
});
