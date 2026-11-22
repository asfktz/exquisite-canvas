<script lang="ts">
  import { onMount } from 'svelte';
  import { panzoom } from '../lib/gestures';
  import { sim, CELL, DIRS, DIR_LABEL, nb, parse, key, fmt, ago, LOCK } from './sim.svelte';

  let mapEl = $state<HTMLElement>();
  let promptText = $state('');

  onMount(() => {
    sim.reset();
    const id = setInterval(() => sim.tick(0.2), 200);
    return () => clearInterval(id);
  });

  type Cell = { k: string; x: number; y: number };
  const cells = $derived.by(() => {
    const ks = new Set<string>([...Object.keys(sim.tiles), ...Object.keys(sim.claims), ...sim.avail]);
    return [...ks].map((k) => { const [x, y] = parse(k); return { k, x, y } as Cell; });
  });

  function onTap(sx: number, sy: number) {
    const r = mapEl!.getBoundingClientRect();
    const wx = sim.cam.x + (sx - r.left - r.width / 2) / sim.cam.s;
    const wy = sim.cam.y + (sy - r.top - r.height / 2) / sim.cam.s;
    const k = key(Math.floor(wx / CELL), Math.floor(wy / CELL));
    const known = sim.tiles[k] || sim.claims[k] || sim.availSet.has(k);
    if (known) sim.tap(k);
    else if (sim.sheet || sim.focus.length) sim.tap(null);
    else sim.tap(k);
  }
  const zoom = (f: number) => (sim.cam = { ...sim.cam, s: Math.min(2.5, Math.max(0.25, sim.cam.s * f)) });

  const draftClaim = $derived(sim.draft ? sim.claims[sim.draft.k] : null);
  const left = $derived(draftClaim ? draftClaim.until - sim.now : 0);
  const cur = $derived(sim.draft && sim.draft.pick >= 0 ? sim.draft.attempts[sim.draft.pick] : null);

  function startCreate() { promptText = ''; }
  $effect(() => { if (sim.screen === 'create' && sim.draft && sim.draft.attempts.length === 0 && !sim.draft.busy) startCreate(); });

  function copyLink(link: string) {
    navigator.clipboard?.writeText(link).catch(() => {});
    sim.toast('הקישור הועתק');
  }
  function restart() { sim.devOpen = false; sim.reset(); }

  const holeLabel = (n: number) => (n >= 3 ? `חור · ${n} צדדים` : n === 2 ? 'פינה · 2 צדדים' : '');
</script>

<div class="root" dir="rtl">
  <!-- ================= INTRO ================= -->
  {#if sim.screen === 'intro'}
    <div class="intro">
      {#if sim.settings.entry === 'link' && sim.linkFrom && sim.reservedFor}
        <p class="muted">קיבלת קישור</p>
        <h1>דנה מעבירה לך את המקל</h1>
        <div class="box tile big">
          <div class="p">"{sim.tiles[sim.linkFrom].prompt}"</div>
          <div class="a">דנה · {ago(-sim.tiles[sim.linkFrom].at)}</div>
        </div>
        <p>הריבוע שליד הציור שלה שמור לך ל-{fmt(sim.claims[sim.reservedFor]?.until - sim.now)}.<br />תמשיך את מה שהיא התחילה.</p>
        <button class="btn primary" onclick={() => sim.enter(true)}>המשך ממנה</button>
        <button class="btn" onclick={() => sim.enter(false)}>קודם להסתכל במפה</button>
      {:else}
        <h1>ציור משותף</h1>
        <p>כל אחד מוסיף ריבוע אחד, צמוד לציור שכבר קיים.<br />רואים רק את מה שנוגע בך.</p>
        <div class="stats">
          <div><b>{Object.keys(sim.tiles).length}</b>ריבועים</div>
          <div><b>{sim.painters}</b>מציירים עכשיו</div>
          <div><b>{sim.avail.length}</b>מקומות פנויים</div>
        </div>
        <button class="btn primary" onclick={() => sim.enter()}>בוא נצייר</button>
      {/if}
      <button class="link" onclick={() => (sim.devOpen = true)}>⚙ הגדרות סימולציה</button>
    </div>
  {/if}

  <!-- ================= MAP ================= -->
  {#if sim.screen === 'map'}
    <div
      class="map"
      bind:this={mapEl}
      bind:clientWidth={sim.vw}
      bind:clientHeight={sim.vh}
      use:panzoom={{ enabled: () => true, get: () => ({ ...sim.cam }), set: (v) => (sim.cam = v), onTap, minS: 0.25, maxS: 2.5, touchEvents: false }}
    >
      <div class="world" style="transform: translate({sim.vw / 2}px, {sim.vh / 2}px) scale({sim.cam.s}) translate({-sim.cam.x}px, {-sim.cam.y}px)">
        {#each cells as c (c.k)}
          {@const t = sim.tiles[c.k]}
          {@const cl = sim.claims[c.k]}
          {@const touch = t || cl ? [] : sim.touching(c.k)}
          <div
            class="cell"
            class:tile={!!t}
            class:mine={t?.mine}
            class:avail={!t && !cl}
            class:hole={!t && !cl && touch.length >= 3}
            class:bot={cl?.kind === 'bot'}
            class:me={cl?.kind === 'me' || cl?.kind === 'away'}
            class:friend={cl?.kind === 'friend'}
            class:reserved={cl?.kind === 'reserved'}
            class:sel={sim.sel === c.k}
            class:focus={sim.focus.includes(c.k)}
            style="left:{c.x * CELL}px; top:{c.y * CELL}px; width:{CELL}px; height:{CELL}px"
          >
            {#if t}
              <div class="p">{t.prompt}</div>
              <div class="a">{t.author}</div>
              {#if sim.now - t.at < 25}<span class="badge">חדש</span>{/if}
            {:else if cl?.kind === 'bot'}
              <div class="p">🔒 {cl.by}</div><div class="a">מצייר/ת…</div>
            {:else if cl?.kind === 'friend'}
              <div class="p">שמור ל{cl.by}</div><div class="a">{fmt(cl.until - sim.now)}</div>
            {:else if cl?.kind === 'reserved'}
              <div class="p">שמור לך</div><div class="a">{fmt(cl.until - sim.now)}</div>
            {:else if cl}
              <div class="p">שלך</div><div class="a">{cl.kind === 'away' ? 'מחכה לך ' : ''}{fmt(cl.until - sim.now)}</div>
            {:else}
              {#each touch as d}<i class="edge {d}"></i>{/each}
              <div class="plus">+</div>
              {#if touch.length >= 2}<div class="a">{holeLabel(touch.length)}</div>{/if}
              {#if sim.fresh[c.k]}<span class="badge">נפתח</span>{/if}
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <div class="topbar">
      <span class="chip">● {sim.credits} קרדיטים</span>
      <span class="chip">{sim.avail.length} פנויים · {sim.painters} מציירים</span>
      <button class="chip" onclick={() => (sim.devOpen = true)}>⚙</button>
    </div>
    {#if sim.hint}<div class="hint">{sim.hint}</div>{/if}

    {#if !sim.sheet}
      <div class="bottombar">
        <div class="zoom">
          <button class="btn sm" onclick={() => zoom(1.25)}>+</button>
          <button class="btn sm" onclick={() => zoom(0.8)}>−</button>
          <button class="btn sm" onclick={() => sim.fitAll()}>⤢</button>
        </div>
        {#if sim.lastMine}<button class="btn" onclick={() => { sim.center(sim.lastMine!); sim.sel = sim.lastMine; sim.sheet = 'filled'; }}>הריבוע שלי</button>{/if}
        <button class="btn primary" onclick={() => sim.findSpot()}>מצא לי מקום</button>
      </div>
    {/if}
  {/if}

  <!-- ================= CREATE ================= -->
  {#if sim.screen === 'create' && sim.draft}
    {@const d = sim.draft}
    <div class="create">
      <div class="ctop">
        <button class="btn sm" onclick={() => (sim.sheet = 'leave')}>✕ יציאה</button>
        <span class:warn={left <= 30}>שמור לך {fmt(left)}</span>
        <span>● {sim.credits}</span>
      </div>
      {#if left <= 30}
        <div class="banner">
          נשארו {fmt(left)} לפני שהריבוע משתחרר.
          {#if !d.extended}<button class="btn sm" onclick={() => sim.extend()}>+2 דק׳</button>{/if}
        </div>
      {/if}

      <div class="nine">
        {#each [-1, 0, 1] as dy}
          {#each [-1, 0, 1] as dx}
            {@const [cx, cy] = parse(d.k)}
            {@const k = key(cx + dx, cy + dy)}
            {@const t = sim.tiles[k]}
            {@const cl = sim.claims[k]}
            {#if dx === 0 && dy === 0}
              <div class="n center" class:has={!!cur}>
                {#if d.busy}<div class="p">יוצר…</div>
                {:else if cur}<div class="a">ניסיון {cur.n}</div><div class="p">{cur.prompt}</div>
                {:else}<div class="p">הריבוע שלך</div><div class="a">צריך להתחבר ל-{sim.touching(k).length} צדדים</div>{/if}
              </div>
            {:else}
              <div class="n" class:filled={!!t} class:corner={dx !== 0 && dy !== 0}>
                {#if t}<div class="p">{t.prompt}</div><div class="a">{t.author}</div>
                {:else if cl && cl.kind !== 'me'}<div class="a">{cl.kind === 'bot' ? `${cl.by} מצייר/ת` : 'שמור'}</div>
                {:else}<div class="a">ריק</div>{/if}
              </div>
            {/if}
          {/each}
        {/each}
      </div>

      {#if d.attempts.length}
        <div class="attempts">
          <span class="muted">ניסיונות:</span>
          {#each d.attempts as a, i}
            <button class="btn sm" class:on={d.pick === i} onclick={() => { d.pick = i; promptText = a.prompt; }}>{a.n}</button>
          {/each}
        </div>
      {/if}

      <div class="compose">
        <textarea rows="2" placeholder="מה מצויר בריבוע שלך?" bind:value={promptText} disabled={d.busy}></textarea>
        <div class="row">
          {#if cur && promptText.trim() === cur.prompt}
            <button class="btn" disabled={d.busy} onclick={() => sim.generate(promptText)}>נסה שוב · 1 קרדיט</button>
            <button class="btn primary" disabled={d.busy} onclick={() => sim.confirm()}>אשר והוסף למפה</button>
          {:else}
            <button class="btn primary" disabled={d.busy || !promptText.trim()} onclick={() => sim.generate(promptText)}>
              {d.busy ? 'יוצר…' : cur ? 'צור גרסה חדשה · 1 קרדיט' : 'צור · 1 קרדיט'}
            </button>
            {#if cur}<button class="btn" disabled={d.busy} onclick={() => sim.confirm()}>אשר ניסיון {cur.n}</button>{/if}
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- ================= SHEETS ================= -->
  {#if sim.sheet}
    <div class="sheet">
      {#if sim.sheet === 'cell' && sim.sel}
        {@const k = sim.sel}
        {@const cl = sim.claims[k]}
        {@const touch = sim.touching(k)}
        {#if sim.tiles[k] || (cl && cl.kind !== 'reserved')}
          <h3>נתפס עכשיו</h3>
          <p>{cl ? `${cl.by} תפס/ה את הריבוע הזה רגע לפניך.` : 'מישהו כבר צייר כאן.'}</p>
          <div class="row">
            <button class="btn primary" onclick={() => sim.findSpot()}>מצא מקום אחר</button>
            <button class="btn" onclick={() => sim.tap(null)}>סגור</button>
          </div>
        {:else}
          <h3>{cl?.kind === 'reserved' ? `שמור לך עוד ${fmt(cl.until - sim.now)}` : touch.length >= 3 ? `חור באמצע · נוגע ב-${touch.length} צדדים` : 'ריבוע פנוי'}</h3>
          <ul class="nbrs">
            {#each DIRS as dd}
              {@const t = sim.tiles[nb(k, dd)]}
              <li class:dim={!t}><span>{DIR_LABEL[dd]}</span>{t ? `"${t.prompt}" · ${t.author}` : 'ריק'}</li>
            {/each}
          </ul>
          {#if touch.length >= 2}<p class="muted">הציור שלך יצטרך להתחבר לכל {touch.length} הצדדים.</p>{/if}
          {#if sim.credits <= 0}<p class="warn">אין לך קרדיטים. תוכל לתפוס, אבל לא ליצור.</p>{/if}
          <p class="muted">התפיסה נועלת את הריבוע לך ל-{LOCK / 60} דקות.</p>
          <div class="row">
            <button class="btn primary" disabled={sim.pending} onclick={() => sim.claim(k)}>{sim.pending ? 'תופס…' : 'תפוס ותתחיל לצייר'}</button>
            <button class="btn" onclick={() => sim.findSpot()}>אחר</button>
            <button class="btn" onclick={() => sim.tap(null)}>✕</button>
          </div>
        {/if}

      {:else if sim.sheet === 'filled' && sim.sel && sim.tiles[sim.sel]}
        {@const t = sim.tiles[sim.sel]}
        {@const free = sim.adjAvail(sim.sel).length}
        <h3>"{t.prompt}"</h3>
        <p class="muted">{t.author} · {ago(sim.now - t.at)}</p>
        <div class="row">
          <button class="btn primary" disabled={!free} onclick={() => sim.continueFrom(sim.sel!)}>{free ? `המשך מכאן (${free} פנויים)` : 'אין מקום פנוי צמוד'}</button>
          {#if t.mine}<button class="btn" onclick={() => sim.share()}>שתף</button>{/if}
          <button class="btn" onclick={() => sim.tap(null)}>✕</button>
        </div>

      {:else if sim.sheet === 'race' && sim.sel}
        <h3>מישהו הקדים אותך</h3>
        <p>{sim.claims[sim.sel]?.by ?? 'מישהו'} תפס/ה את הריבוע הזה שנייה לפניך.</p>
        <div class="row">
          <button class="btn primary" onclick={() => { const n = sim.nearest(sim.sel!); if (n) { sim.sel = n; sim.sheet = 'cell'; sim.center(n); } else sim.tap(null); }}>קח את הפנוי הכי קרוב</button>
          <button class="btn" onclick={() => sim.tap(null)}>חזור למפה</button>
        </div>

      {:else if sim.sheet === 'confirmed'}
        <h3>נוסף למפה ✓</h3>
        <p>{sim.freshCount ? `נפתחו ${sim.freshCount} מקומות חדשים ליד הריבוע שלך.` : 'הריבוע שלך סגר את החור.'}</p>
        <div class="col">
          <button class="btn primary" onclick={() => sim.share()}>העבר הלאה: "תמשיך ממני"</button>
          <button class="btn" onclick={() => sim.drawAnother()}>צייר עוד אחד צמוד</button>
          <button class="btn" onclick={() => sim.tap(null)}>חזור למפה</button>
        </div>

      {:else if sim.sheet === 'share' && sim.lastMine}
        {@const link = `exq.art/c/${sim.lastMine.replace(',', '_')}`}
        {@const r = sim.shared[sim.lastMine]}
        <h3>תמשיך ממני</h3>
        <p>מי שיפתח את הקישור ינחת ישר ליד הריבוע שלך.{r ? ' הריבוע הצמוד שמור לו ל-10 דקות.' : ' אין ריבוע צמוד פנוי, אז הוא ינחת בפנוי הקרוב.'}</p>
        <div class="linkbox">{link}</div>
        <p class="muted">כשהוא ימשיך, תקבל הודעה. (בסימולציה: רון יפתח את הקישור בעוד רגע)</p>
        <div class="row">
          <button class="btn primary" onclick={() => copyLink('https://' + link)}>העתק קישור</button>
          <button class="btn" onclick={() => sim.tap(null)}>סגור</button>
        </div>

      {:else if sim.sheet === 'leave' && sim.draft}
        {@const c = sim.draft.pick >= 0 ? sim.draft.attempts[sim.draft.pick] : null}
        <h3>לצאת בלי לאשר?</h3>
        <p class="muted">הריבוע עדיין לא במפה.</p>
        <div class="col">
          {#if c}<button class="btn primary" onclick={() => sim.confirm()}>אשר את ניסיון {c.n} וצא</button>{/if}
          <button class="btn" onclick={() => sim.leaveKeep()}>שמור לי את הריבוע לדקה</button>
          <button class="btn" onclick={() => sim.leaveRelease()}>שחרר אותו לאחרים</button>
          <button class="btn" onclick={() => (sim.sheet = null)}>המשך לצייר</button>
        </div>

      {:else if sim.sheet === 'nocredits'}
        {@const c = sim.draft && sim.draft.pick >= 0 ? sim.draft.attempts[sim.draft.pick] : null}
        <h3>נגמרו הקרדיטים</h3>
        <p>הריבוע עדיין שמור לך. מה עושים?</p>
        <div class="col">
          <button class="btn primary" onclick={() => { sim.credits += 5; sim.sheet = null; }}>קבל 5 קרדיטים (מדומה)</button>
          {#if c}<button class="btn" onclick={() => sim.confirm()}>אשר את ניסיון {c.n} כמו שהוא</button>{/if}
          <button class="btn" onclick={() => sim.releaseFromNoCredits()}>שחרר את הריבוע</button>
        </div>

      {:else if sim.sheet === 'expired'}
        {@const free = sim.sel && sim.availSet.has(sim.sel)}
        <h3>הזמן נגמר</h3>
        <p>הריבוע שוחרר והטיוטה נמחקה.</p>
        <div class="row">
          {#if free}<button class="btn primary" onclick={() => sim.claim(sim.sel!)}>תפוס אותו שוב</button>{/if}
          <button class="btn" onclick={() => sim.tap(null)}>חזור למפה</button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- ================= TOASTS ================= -->
  <div class="toasts">
    {#each sim.toasts as t (t.id)}
      <div class="toast">
        <span>{t.text}</span>
        {#if t.action}<button class="btn sm" onclick={() => { t.action!.run(); sim.dismiss(t.id); }}>{t.action.label}</button>{/if}
      </div>
    {/each}
  </div>

  <!-- ================= DEV PANEL ================= -->
  {#if sim.devOpen}
    <div class="dev">
      <div class="devhead"><h3>הגדרות סימולציה</h3><button class="btn sm" onclick={() => (sim.devOpen = false)}>✕</button></div>

      <div class="lbl">איך נכנסים</div>
      <div class="seg">
        <button class:on={sim.settings.entry === 'organic'} onclick={() => { sim.settings.entry = 'organic'; restart(); }}>כניסה רגילה</button>
        <button class:on={sim.settings.entry === 'link'} onclick={() => { sim.settings.entry = 'link'; restart(); }}>מקישור של חבר</button>
      </div>

      <div class="lbl">כניסה רגילה: איפה המצלמה מתחילה</div>
      <div class="seg">
        <button class:on={sim.settings.start === 'center'} onclick={() => { sim.settings.start = 'center'; sim.settings.entry = 'organic'; restart(); }}>כל המפה</button>
        <button class:on={sim.settings.start === 'recent'} onclick={() => { sim.settings.start = 'recent'; sim.settings.entry = 'organic'; restart(); }}>פעילות אחרונה</button>
        <button class:on={sim.settings.start === 'nearest'} onclick={() => { sim.settings.start = 'nearest'; sim.settings.entry = 'organic'; restart(); }}>ישר לריבוע פנוי</button>
      </div>

      <div class="lbl">קרדיטים</div>
      <div class="seg">
        {#each [0, 1, 5] as n}<button class:on={sim.credits === n} onclick={() => { sim.credits = n; sim.settings.credits = n; }}>{n}</button>{/each}
      </div>

      <div class="lbl">מהירות הזמן</div>
      <div class="seg">
        {#each [1, 5, 20] as n}<button class:on={sim.settings.speed === n} onclick={() => (sim.settings.speed = n)}>×{n}</button>{/each}
      </div>

      <div class="lbl">מקרי קצה</div>
      <div class="seg">
        <button class:on={sim.settings.race} onclick={() => (sim.settings.race = !sim.settings.race)}>התפיסה הבאה תיכשל</button>
        <button class:on={sim.settings.bots} onclick={() => (sim.settings.bots = !sim.settings.bots)}>משתמשים מדומים</button>
      </div>

      <button class="btn primary wide" onclick={restart}>התחל מחדש</button>

      <div class="lbl">מקרא</div>
      <div class="legend">
        <div><i class="cell tile"></i>מלא</div>
        <div><i class="cell avail"></i>פנוי (נוגע בציור)</div>
        <div><i class="cell avail hole"></i>חור באמצע</div>
        <div><i class="cell bot"></i>מישהו מצייר</div>
        <div><i class="cell me"></i>שלך</div>
        <div><i class="cell friend"></i>שמור לחבר</div>
      </div>
      <p class="muted">הפס העבה בצד של ריבוע פנוי מסמן איזה צד נוגע בציור קיים.</p>
    </div>
  {/if}
</div>

<style>
  :global(html, body, #app) { height: 100%; margin: 0; overflow: hidden; overscroll-behavior: none; background: #fff; color: #111; }
  :global(body) { font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; -webkit-tap-highlight-color: transparent; }
  .root { position: fixed; inset: 0; font-size: 15px; }
  h1 { font-size: 26px; margin: 0 0 8px; }
  h3 { font-size: 17px; margin: 0 0 6px; }
  p { margin: 6px 0; line-height: 1.45; }
  .muted { color: #777; font-size: 13px; }
  .warn { color: #c00; }
  .btn { font: inherit; border: 1.5px solid #111; background: #fff; color: #111; border-radius: 8px; padding: 10px 14px; cursor: pointer; }
  .btn.primary { background: #111; color: #fff; }
  .btn.sm { padding: 5px 10px; font-size: 14px; }
  .btn.on { background: #2563eb; border-color: #2563eb; color: #fff; }
  .btn:disabled { opacity: 0.4; }
  .btn.wide { width: 100%; margin-top: 14px; }
  .link { background: none; border: 0; color: #555; text-decoration: underline; margin-top: 18px; font: inherit; }
  .row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .row .btn.primary { flex: 1; }
  .col { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }

  .intro { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px; text-align: center; }
  .intro .btn { width: 100%; max-width: 320px; }
  .stats { display: flex; gap: 18px; margin: 10px 0 14px; font-size: 13px; color: #555; }
  .stats div { display: flex; flex-direction: column; }
  .stats b { font-size: 22px; color: #111; }
  .box.tile.big { width: 150px; height: 150px; background: #d6d6d6; border: 1.5px solid #888; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px; box-sizing: border-box; margin: 6px 0; }
  .box .p { font-weight: 600; }
  .box .a { font-size: 12px; color: #555; }

  .map { position: absolute; inset: 0; touch-action: none; background: #fafafa; background-image: radial-gradient(#ddd 1px, transparent 1px); background-size: 20px 20px; overflow: hidden; }
  .world { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
  .cell { position: absolute; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 6px; overflow: hidden; }
  .cell .p { font-size: 13px; font-weight: 600; line-height: 1.2; }
  .cell .a { font-size: 11px; color: #555; margin-top: 3px; }
  .cell.tile { background: #d6d6d6; border: 1px solid #aaa; }
  .cell.tile.mine { border: 3px solid #111; }
  .cell.avail { border: 2px dashed #888; margin: 0; background: #fff; }
  .cell.avail .plus { font-size: 28px; color: #888; line-height: 1; }
  .cell.hole { background: #eef2ff; border-color: #2563eb; }
  .cell.hole .plus, .cell.hole .a { color: #2563eb; }
  .cell.bot { background: repeating-linear-gradient(45deg, #e5e5e5 0 6px, #f5f5f5 6px 12px); border: 1px solid #aaa; color: #555; }
  .cell.me { border: 3px solid #111; background: #fff; }
  .cell.friend { border: 2px dotted #111; background: #fff; }
  .cell.reserved { border: 3px dashed #2563eb; background: #eef2ff; }
  .cell.sel { outline: 4px solid #2563eb; outline-offset: -4px; z-index: 2; }
  .cell.focus { background: #dbeafe; }
  .edge { position: absolute; background: #555; }
  .edge.n { top: 0; left: 0; right: 0; height: 5px; }
  .edge.s { bottom: 0; left: 0; right: 0; height: 5px; }
  .edge.e { top: 0; bottom: 0; right: 0; width: 5px; }
  .edge.w { top: 0; bottom: 0; left: 0; width: 5px; }
  .hole .edge { background: #2563eb; }
  .badge { position: absolute; top: 4px; left: 4px; font-size: 10px; background: #111; color: #fff; padding: 1px 5px; border-radius: 4px; }

  .topbar { position: absolute; top: 0; left: 0; right: 0; display: flex; gap: 6px; justify-content: space-between; padding: max(env(safe-area-inset-top), 10px) 10px 0; pointer-events: none; }
  .chip { pointer-events: auto; background: #fff; border: 1.5px solid #111; border-radius: 99px; padding: 5px 11px; font: inherit; font-size: 13px; }
  .hint { position: absolute; top: 52px; left: 50%; transform: translateX(-50%); background: #111; color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 13px; white-space: nowrap; pointer-events: none; }
  .bottombar { position: absolute; bottom: 0; left: 0; right: 0; display: flex; gap: 8px; padding: 10px 10px max(env(safe-area-inset-bottom), 14px); align-items: end; }
  .bottombar > .btn.primary { flex: 1; padding: 14px; font-size: 16px; }
  .zoom { display: flex; flex-direction: column; gap: 4px; }
  .zoom .btn { width: 40px; padding: 6px 0; }

  .sheet { position: absolute; left: 0; right: 0; bottom: 0; background: #fff; border-top: 2px solid #111; padding: 16px 16px max(env(safe-area-inset-bottom), 16px); z-index: 10; max-height: 70%; overflow: auto; }
  .nbrs { list-style: none; padding: 0; margin: 8px 0; font-size: 14px; }
  .nbrs li { padding: 3px 0; display: flex; gap: 8px; }
  .nbrs li span { width: 52px; color: #777; flex: none; }
  .nbrs li.dim { color: #aaa; }
  .linkbox { border: 1.5px dashed #888; padding: 10px; border-radius: 6px; font-family: ui-monospace, monospace; direction: ltr; text-align: left; margin: 8px 0; }

  .create { position: absolute; inset: 0; display: flex; flex-direction: column; padding: max(env(safe-area-inset-top), 10px) 14px max(env(safe-area-inset-bottom), 14px); gap: 10px; overflow: auto; box-sizing: border-box; }
  .ctop { display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
  .ctop .warn { font-weight: 700; }
  .banner { background: #fee2e2; border: 1px solid #c00; padding: 8px 10px; border-radius: 6px; font-size: 14px; display: flex; gap: 8px; align-items: center; justify-content: space-between; }
  .nine { display: grid; grid-template-columns: 1fr 1.6fr 1fr; grid-template-rows: 1fr 1.6fr 1fr; gap: 4px; width: 100%; max-width: 380px; aspect-ratio: 1; margin: 0 auto; direction: ltr; }
  .n { border: 1.5px dashed #bbb; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 4px; font-size: 12px; color: #999; overflow: hidden; direction: rtl; }
  .n.filled { background: #d6d6d6; border: 1px solid #aaa; color: #111; }
  .n.corner { opacity: 0.5; }
  .n .p { font-weight: 600; }
  .n .a { font-size: 11px; }
  .n.center { border: 3px solid #111; background: #fff; color: #111; font-size: 15px; }
  .n.center.has { background: #bdbdbd; }
  .attempts { display: flex; gap: 6px; align-items: center; justify-content: center; }
  .compose textarea { width: 100%; box-sizing: border-box; font: inherit; font-size: 16px; border: 1.5px solid #111; border-radius: 8px; padding: 10px; resize: none; }

  .toasts { position: absolute; top: 56px; left: 10px; right: 10px; display: flex; flex-direction: column; gap: 6px; align-items: center; z-index: 30; pointer-events: none; }
  .toast { pointer-events: auto; background: #111; color: #fff; padding: 8px 12px; border-radius: 8px; font-size: 14px; display: flex; gap: 10px; align-items: center; max-width: 100%; }
  .toast .btn { background: #fff; color: #111; border-color: #fff; }

  .dev { position: absolute; inset: 0; background: #fff; z-index: 40; padding: max(env(safe-area-inset-top), 14px) 16px 24px; overflow: auto; }
  .devhead { display: flex; justify-content: space-between; align-items: center; }
  .dev .lbl { display: block; font-size: 13px; color: #777; margin: 14px 0 6px; }
  .seg { display: flex; border: 1.5px solid #111; border-radius: 8px; overflow: hidden; }
  .seg button { flex: 1; font: inherit; font-size: 13px; padding: 9px 4px; background: #fff; border: 0; border-inline-start: 1px solid #111; }
  .seg button:first-child { border: 0; }
  .seg button.on { background: #111; color: #fff; }
  .legend { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; }
  .legend div { display: flex; gap: 8px; align-items: center; }
  .legend .cell { position: static; width: 26px; height: 26px; padding: 0; flex: none; }
</style>
