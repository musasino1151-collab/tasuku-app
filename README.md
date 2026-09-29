# チームタスク管理アプリ（Asana 風）

リアルタイムで同期する社内向けタスク管理アプリです。担当者が決まったとき、コメントが付いたとき、期限の前日と当日には Amazon SES からメールで通知します。

## 構成

| 役割 | サービス | 備考 |
|---|---|---|
| 画面 | React + Vite（静的サイト） | Cloudflare Workers に置く |
| DB・ログイン・リアルタイム同期 | Supabase | 変更は 1 秒以内に全員の画面へ反映 |
| メール送信 | Supabase Edge Function → Amazon SES | 通知データの作成から送信までサーバー側で完結 |
| 期限リマインド | Supabase pg_cron | 毎朝 8:00（日本時間） |

## 機能

- マイタスク：自分の担当を「期限切れ／今日／今後 7 日間／それ以降／期限なし」に分けて表示。自分が他の人に依頼したタスクも一覧できる
- プロジェクト：リスト・ボード（カンバン）・カレンダーの 3 表示。セクションの追加・名前変更・削除。ドラッグで並べ替え・移動・期限変更
- タスク詳細：担当者、期限、プロジェクト／セクション、優先度、説明、サブタスク、コメント、変更履歴
- 受信トレイ：割り当て・コメント・完了・期限のお知らせ（未読バッジつき）
- メール通知
  - タスクが自分に割り当てられたとき
  - 自分が担当・作成・コメントしたタスクに新しいコメントが付いたとき
  - 自分が依頼したタスクが完了したとき
  - 期限の前日と当日の朝 8:00
- 検索（`/` キー）、フィルター（完了状態・担当者）、プロジェクトのアーカイブ
- スマホ表示対応
- 通知メールは個人設定でオフにできる

---

## セットアップ手順（所要時間は約 40 分）

### 1. Supabase プロジェクトを作る

1. https://supabase.com でプロジェクトを作成します（Region は **Northeast Asia (Tokyo)** を選びます）。
2. 左メニュー **SQL Editor** を開き、`supabase/schema.sql` の中身を全部貼り付けて **Run** します（1 回だけ実行します）。
3. **Authentication → Sign In / Providers** で **Allow new users to sign up** を **OFF** にします。これで、あなたが発行したアカウント以外はログインできなくなります。
4. **Authentication → Users → Add user → Create new user** で、メンバーごとにメールアドレスと初期パスワードを入れ、**Auto Confirm User** に ✓ を入れて作成します。
   - 表示名は最初メールアドレスの @ より前になります。各自がアプリの「設定」で変更できます。
   - パスワードも各自が「設定」から変更できます。

### 2. Amazon SES を準備する

1. SES コンソール（例：東京リージョン `ap-northeast-1`）で、送信元のドメインまたはメールアドレスが **Verified** になっていることを確認します。
2. アカウントが **サンドボックス** のままだと、認証済みのアドレスにしか送れません。「本番アクセス（Production access）」を申請済みか確認してください。
3. IAM で送信専用ユーザーを作り、次のポリシーを付けてアクセスキーを発行します。

```json
{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Action": ["ses:SendEmail"], "Resource": "*" }]
}
```

### 3. メール送信用の Edge Function をデプロイする

**方法 A：ブラウザだけで行う**

1. Supabase の **Edge Functions → Deploy a new function → Via Editor** を開きます。
2. 関数名を `send-email` にし、`supabase/functions/send-email/index.ts` の中身を貼り付けて **Deploy** します。
3. 関数の **Details / Settings** で **Verify JWT（Enforce JWT verification）** を **OFF** にします。

**方法 B：CLI で行う**

```bash
npx supabase login
npx supabase functions deploy send-email --no-verify-jwt --project-ref <プロジェクトREF>
```

**シークレットを設定する**（Edge Functions → Secrets。CLI なら `npx supabase secrets set KEY=VALUE`）

| キー | 値の例 |
|---|---|
| `EMAIL_SECRET` | ランダムな長い文字列（`openssl rand -hex 32` などで作る） |
| `SES_REGION` | `ap-northeast-1` |
| `SES_ACCESS_KEY_ID` | 手順 2 で発行したキー |
| `SES_SECRET_ACCESS_KEY` | 手順 2 で発行したシークレット |
| `MAIL_FROM` | `TERRA BRIDGE Tasks <tasks@あなたのドメイン>` |
| `APP_URL` | 手順 5 で決まる URL（あとで設定してもかまいません） |
| `APP_NAME` | `TERRA BRIDGE Tasks` |

### 4. データベースに通知先を登録する

SQL Editor で次を実行します。`<プロジェクトREF>` と `EMAIL_SECRET` は、自分の値に置き換えてください。

```sql
insert into private.app_config (key, value) values
  ('functions_url', 'https://<プロジェクトREF>.supabase.co/functions/v1'),
  ('email_secret',  '<EMAIL_SECRET と同じ文字列>')
on conflict (key) do update set value = excluded.value;
```

### 5. Cloudflare に公開する（無料・商用可）

1. このフォルダを GitHub の非公開リポジトリにアップロードします。
2. Cloudflare ダッシュボード → **Workers & Pages** → **Create** → **Import a repository** で、そのリポジトリを選びます。
3. 設定は次のとおりにします。
   - **Build command**：`npm run build`
   - **Deploy command**：`npx wrangler deploy`（`wrangler.jsonc` を同梱済み）
   - **Build variables**（ビルド時の変数）に次を追加します。

| キー | 値 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API の Project URL |
| `VITE_SUPABASE_ANON_KEY` | 同じ画面の anon key（または publishable key） |
| `VITE_APP_NAME` | `TERRA BRIDGE Tasks` |

4. デプロイが終わると、`https://team-tasks.<あなたのアカウント>.workers.dev` という URL が発行されます。この URL を手順 3 の `APP_URL` に設定します。
5. GitHub に変更を push すると、自動で再デプロイされます。

### 6. 動作を確認する

1. 2 つのアカウントで、別々のブラウザからログインします。
2. A が B にタスクを割り当てると、B の画面にすぐ表示され、受信トレイのバッジが付いてメールが届くことを確認します。
3. メールが届かないときは、次を確認します。
   - SQL Editor で `select status_code, content from net._http_response order by created desc limit 10;` を実行し、Edge Function の応答を見ます。
   - Edge Functions → send-email → **Logs** に SES のエラー内容が出ます。
   - 403 が返っている場合は、`EMAIL_SECRET` と `private.app_config` の値が一致していません。
   - SES のエラーの場合は、送信元が未認証か、アカウントがサンドボックスのままになっています。

---

## 費用の目安（2026 年 9 月時点。最新の料金は各サービスで確認してください）

| サービス | 無料枠 | 注意点 |
|---|---|---|
| Supabase Free | DB 500MB | 1 週間アクセスがないと一時停止します。毎日使っていれば問題ありません。止めたくない場合は Pro（月 $25） |
| Amazon SES | — | 1,000 通あたり $0.10。10 人で月 3,000 通送っても約 $0.3 |
| Cloudflare Workers | 静的ファイルへのアクセスは無料・無制限 | 商用利用可 |

このアプリの画面部分はただの静的ファイル（`npm run build` で作られる `dist/`）です。Vercel や Netlify など、他の静的ホスティングにもコードを変えずに置けます。

## ローカルで動かす

```bash
npm install
cp .env.example .env    # 値を入れる
npm run dev
```

サーバーなしで画面だけ確認したいときは、`.env` に `VITE_DEMO=1` を入れて `npm run dev` を実行します。サンプルデータで動くデモモードになり、変更は保存されません。

## メンバーを追加するとき

Supabase → Authentication → Users → **Add user** で作成します。人数の制限はありません。

## ファイル構成

```
supabase/schema.sql                      DB・権限・通知トリガー・リマインド
supabase/functions/send-email/index.ts   SES でメールを送る Edge Function
src/store.jsx                            データ取得・リアルタイム同期・保存処理
src/components/                          画面（マイタスク、受信トレイ、リスト、ボード、カレンダー、詳細）
```

## 設計メモ

- 画面の操作は先に画面へ反映し、裏で保存します（楽観的更新）。保存に失敗した場合は元に戻して通知します。
- 同じ項目を 2 人が同時に編集した場合は、後から保存したほうが残ります。説明を入力している最中に、他の人の変更で上書きされることはありません。
- 通知とメールはデータベースのトリガーで作られます。そのため、画面を閉じた直後でも通知は確実に届きます。
- ログインしたメンバーは全員、すべてのプロジェクトを閲覧・編集できます。プロジェクトごとに権限を分けたい場合は、`schema.sql` の RLS ポリシーを変更します。
