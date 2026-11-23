# Mimic iOS アプリ

B Pocket（`mimic/pocket.html`）のデザインを、Capacitor で iPhone アプリにしたものです。Mac がなくても、Codemagic（クラウドの Mac）で作って App Store に出せます。

## しくみ

| ところ | 中身 |
|---|---|
| `scripts/build-www.mjs` | `mimic/pocket.html` からアプリの画面（`www/`）を作る。Pocket を直すと、次のビルドでアプリにも反映される |
| `src/app.js` / `src/app.css` | アプリだけの仕組み：課金、プランの表示、共有シートでの書き出し、裏に回るときの保存 |
| `ios/` | iOS のプロジェクト（Capacitor 8、Swift Package Manager） |
| `../codemagic.yaml` | Codemagic でビルドして TestFlight に送る設定 |
| `../privacy.html` / `../support.html` | App Store に載せるプライバシーポリシーとサポートのページ |

課金のルール：

- ログインは使わず、Apple ID の購入で判断する。サーバーも使わない
- 無料はプロジェクト1つまで。プレミアム（月額）は無制限
- 解約しても作ったプロジェクトは消えない。新しく作るのだけ止まる
- オフラインでも前回確かめた購入状況で使える。期限を過ぎても3日は猶予がある

ログインなしで課金すると決めた理由と、その弱いところは [`docs/decisions.md`](../docs/decisions.md) に記録しています。

## 決まっている値

| 項目 | 値 |
|---|---|
| アプリ名 | Mimic（仮） |
| バンドル ID | `io.github.kento20020.mimic` |
| 月額課金の製品 ID | `mimic.premium.monthly` |
| 無料で作れるプロジェクト | 1 |
| プライバシーポリシー | https://kento20020.github.io/english-lisening/privacy.html |
| サポート | https://kento20020.github.io/english-lisening/support.html |

名前や製品 ID を変えるときは、`capacitor.config.json`・`ios/App/App.xcodeproj/project.pbxproj`・`src/app.js`・`../codemagic.yaml` を合わせて直します。

## App Store に出すまでの手順

### 1. Apple Developer Program に登録する（個人）

- https://developer.apple.com/programs/enroll/ から登録します（年12,980円）。
- Apple ID の2ファクタ認証が必要です。
- 個人で登録すると、App Store の販売者欄に本名が表示されます。

### 2. 有料アプリの契約と、口座・税金の情報

- App Store Connect の「ビジネス」で、有料アプリの契約に同意し、銀行口座と税務情報を登録します。
- これが済むまで、課金のテストもできません。

### 3. 小規模事業者プログラムに申し込む

- 申し込まないと手数料は 26%、申し込むと 15% になります（年の売上が100万ドル以下の場合）。

### 4. アプリを登録する

1. Apple Developer の「Certificates, Identifiers & Profiles」→「Identifiers」で、App ID `io.github.kento20020.mimic` を登録します。
2. App Store Connect の「マイ App」→「＋」→「新規 App」で作ります。
   - プラットフォーム：iOS
   - 名前：Mimic（使われていたら別の名前にします）
   - 主言語：日本語
   - バンドル ID：上で登録したもの
   - SKU：例 `mimic-ios`
3. 作ったアプリの「App 情報」にある「Apple ID」（数字）を、`../codemagic.yaml` の `APP_STORE_APPLE_ID` に書きます。

### 5. 月額課金の商品を作る

App Store Connect のアプリのページ →「サブスクリプション」で作ります。

- サブスクリプショングループ：「Mimic プレミアム」
- 製品 ID：`mimic.premium.monthly`（この通りにする）
- 期間：1か月
- 価格：500円
- 表示名と説明（日本語）：例「プレミアム」「プロジェクトを無制限に作れます」
- 審査用のスクリーンショット：アプリの課金画面

### 6. App Store Connect API キーを作る

- 「ユーザとアクセス」→「統合」→「App Store Connect API」でキーを作ります（アクセス：App Manager）。
- `.p8` ファイルは一度しかダウンロードできないので、大切に保管してください。
- Issuer ID と Key ID も控えておきます。

### 7. Codemagic の準備

1. https://codemagic.io に GitHub でサインアップし、`kento20020/english-lisening` を追加します。個人アカウントなら、Mac のビルドが月500分まで無料です（1回15〜25分ほど）。
2. 設定の「Integrations」で App Store Connect の API キーを登録し、名前を `Mimic` にします（`codemagic.yaml` の `integrations` と同じ名前）。
3. 「Code signing identities」で、iOS の配布用証明書を作って保存します（「Generate certificate」）。
4. アプリのページで「Start new build」→「Mimic iOS（TestFlight へ）」を選ぶと、ビルドして TestFlight に送ります。

### 8. TestFlight で iPhone に入れて試す

- iPhone に TestFlight アプリを入れ、App Store Connect の TestFlight で自分をテスターに追加します。
- TestFlight での購入はテスト用なので、実際には請求されません。月額の更新も、テスト用に数分で進みます。
- 確かめること：
  - [ ] マイクの許可が出て、録音・再生ができる
  - [ ] 消音スイッチがオンでも、お手本と自分の声が聞こえる
  - [ ] 2つ目のプロジェクトを作ろうとすると、プレミアムの案内が出る
  - [ ] 購入すると、プロジェクトを好きなだけ作れる
  - [ ] アプリを消して入れ直し、「購入を復元」でプレミアムに戻る
  - [ ] 書き出しで共有シートが出て、ファイルに保存できる
  - [ ] 機内モードでも録音・再生・プロジェクトの作成ができる
  - [ ] アプリを裏に回して戻っても、プロジェクトが保存されている

### 9. 審査に出す

- スクリーンショット：6.9インチの iPhone 用（1320×2868 など）
- 説明文、キーワード、サポート URL、プライバシーポリシー URL（上の表のもの）
- App のプライバシー：「データを収集しない」
- 年齢制限の質問に答える
- 月額課金の商品を、このバージョンに含めて一緒に審査に出す
- 審査メモの例：「ログインはありません。2つ目のプロジェクトを作ろうとすると、またはプロジェクト一覧の『プレミアム』から、課金画面が開きます。」

## 開発のしかた

```bash
cd app
npm install
npm run build        # www/ を作る
npx cap sync ios     # www/ を iOS のプロジェクトに写す
```

ブラウザで確かめるとき（課金は偽のストアで試せる）：

```bash
cd app/www
python3 -m http.server 8000
```

開発者ツールで `window.__mockStore` に偽のストアを入れてから読み込むと、購入の流れを試せます。

Speak Back に増えた機能を取り込むとき：

```bash
python3 mimic/tools/sync_from_speakback.py
```

`mimic/mimic.js` が作り直され、デザイン案とアプリの両方に反映されます。

## まだ iPhone の実機で確かめていないこと

ここまでの確認は、パソコンのブラウザで偽のストアを使って行いました。次のことは、TestFlight で実機を使って確かめる必要があります。

- アプリの中でのマイク録音と再生
- 消音スイッチがオンのときの再生
- App Store での購入・復元・解約
- 共有シートでの書き出し
- アプリを裏に回したあとのデータの保存（つなぎ直しの仕組みを入れてある）
- iPhone のバックアップから戻したときに、プロジェクトが残るか
