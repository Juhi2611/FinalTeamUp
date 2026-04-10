/* ═══════════════════════════════════════════════════════════════
   TeamUp — Email Notification Service
   Uses EmailJS to send transactional emails.

   Required env vars:
     VITE_EMAILJS_SERVICE_ID   — Your EmailJS service ID
     VITE_EMAILJS_TEMPLATE_ID  — Your EmailJS template ID
     VITE_EMAILJS_PUBLIC_KEY   — Your EmailJS public key

   Optional env vars:
     VITE_APP_NAME             — App display name (default: TeamUp)
     VITE_APP_URL              — App URL for CTA links
════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   Config helpers
───────────────────────────────────────────────────────────── */

const cfg = {
  serviceId:  () => import.meta.env.VITE_EMAILJS_SERVICE_ID  || 'service_ga46jnw',
  templateId: () => import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_z8234ix',
  publicKey:  () => import.meta.env.VITE_EMAILJS_PUBLIC_KEY  || 'NTQ_HSkYjufQlVakK',
  appName:    () => import.meta.env.VITE_APP_NAME            || 'TeamUp',
  appUrl:     () => import.meta.env.VITE_APP_URL             || (typeof window !== 'undefined' ? window.location.origin : 'https://teamup.app'),
};

/* ─────────────────────────────────────────────────────────────
   Low-level sender
───────────────────────────────────────────────────────────── */

const sendEmail = async (to: string, subject: string, html: string): Promise<boolean> => {
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:  cfg.serviceId(),
        template_id: cfg.templateId(),
        user_id:     cfg.publicKey(),
        template_params: {
          to_email: to,
          subject:  subject,
          message:  html,
        },
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('[TeamUp Email] EmailJS Error:', err);
    return false;
  }
};

/* ─────────────────────────────────────────────────────────────
   Brand design tokens
   Extracted directly from the TeamUp landing page:
   • Cobalt blue  — primary action / brand  (#1B5EE4)
   • Teal / mint  — secondary CTA / success (#12B5A8)
   • Deep navy    — header / headings       (#0D1B3E)
   • Off-white    — page background         (#F0F4F8)
   • Charcoal     — body text               (#374151)
───────────────────────────────────────────────────────────── */

const T = {
  /* ── Backgrounds ── */
  pageBg:       '#F0F4F8',
  cardBg:       '#FFFFFF',
  headerBg:     '#0D1B3E',
  footerBg:     '#F7F9FC',

  /* ── Brand colours ── */
  cobalt:       '#1B5EE4',
  teal:         '#12B5A8',

  /* ── Status colours ── */
  green:        '#16A34A',
  greenBg:      '#F0FDF4',
  greenBorder:  '#BBF7D0',
  amber:        '#D97706',
  amberBg:      '#FFFBEB',
  amberBorder:  '#FDE68A',
  red:          '#DC2626',
  redBg:        '#FEF2F2',
  redBorder:    '#FECACA',

  /* ── Typography ── */
  textPrimary:  '#0D1B3E',
  textBody:     '#374151',
  textMuted:    '#6B7280',
  textLight:    '#9CA3AF',

  /* ── Borders ── */
  border:       '#E5E7EB',
  borderLight:  '#F3F4F6',

  /* ── Font ── */
  font: `'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`,
};

/* ─────────────────────────────────────────────────────────────
   Shell — consistent email wrapper used by all 4 templates
───────────────────────────────────────────────────────────── */

interface ShellOptions {
  badgeLabel?: string;
}

const shell = (body: string, opts: ShellOptions = {}): string => {
  const badgeLabel = opts.badgeLabel || 'Notification';
  const app        = cfg.appName();
  const url        = cfg.appUrl();
  const year       = new Date().getFullYear();

  return /* html */`<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${app}</title>
  <style>
    body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
    table { border-collapse:collapse; mso-table-lspace:0; mso-table-rspace:0; }
    a[href*="emailjs.com"], .emailjs-branding { display:none !important; visibility:hidden !important; height:0 !important; overflow:hidden !important; }
    @media only screen and (max-width:600px) {
      .card { border-radius:0 !important; }
      .pad  { padding:24px 18px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${T.pageBg};font-family:${T.font};">

<!-- Inbox preview text -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:${T.pageBg};">
  ${app} &bull; ${badgeLabel}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
  style="background:${T.pageBg};">
  <tr>
    <td align="center" style="padding:40px 16px 52px;">

      <!-- ╔════════════════ CARD ════════════════╗ -->
      <table role="presentation" class="card" cellpadding="0" cellspacing="0"
        style="width:100%;max-width:580px;background:${T.cardBg};
               border-radius:18px;border:1px solid ${T.border};
               box-shadow:0 8px 32px rgba(13,27,62,0.10);">

        <!-- ── Deep navy header ── -->
        <tr>
          <td style="background:${T.headerBg};border-radius:18px 18px 0 0;
                     padding:26px 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <!-- Logo left -->
                <td style="vertical-align:middle;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle;">
                        <div style="width:38px;height:38px;border-radius:10px;
                                    background:linear-gradient(135deg,${T.teal},${T.cobalt});
                                    text-align:center;line-height:38px;font-size:19px;">
                          🧩
                        </div>
                      </td>
                      <td style="padding-left:10px;vertical-align:middle;">
                        <span style="font-size:21px;font-weight:800;color:#FFFFFF;
                                     letter-spacing:-0.4px;font-family:${T.font};">
                          ${app}
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
                <!-- Badge right -->
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;background:rgba(255,255,255,0.13);
                               border:1px solid rgba(255,255,255,0.22);
                               color:rgba(255,255,255,0.88);font-size:10px;
                               font-weight:700;letter-spacing:0.1em;
                               text-transform:uppercase;padding:5px 13px;
                               border-radius:20px;font-family:${T.font};">
                    ${badgeLabel}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Gradient accent line ── -->
        <tr>
          <td style="padding:0;height:3px;line-height:3px;font-size:3px;
                     background:linear-gradient(90deg,${T.cobalt} 0%,${T.teal} 100%);">
            &nbsp;
          </td>
        </tr>

        <!-- ── Email body ── -->
        <tr>
          <td class="pad" style="padding:36px 36px 32px;">
            ${body}
          </td>
        </tr>

        <!-- ── Footer ── -->
        <tr>
          <td style="border-top:1px solid ${T.border};background:${T.footerBg};
                     border-radius:0 0 18px 18px;padding:18px 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:12px;color:${T.textMuted};
                             line-height:1.8;font-family:${T.font};">
                    You're receiving this as a member of a
                    <a href="${url}" style="color:${T.cobalt};text-decoration:none;
                       font-weight:600;">${app}</a> team.
                  </p>
                  <p style="margin:4px 0 0;font-size:11px;
                             color:${T.textLight};font-family:${T.font};">
                    <a href="${url}/settings"
                       style="color:${T.textLight};text-decoration:underline;">
                      Manage preferences
                    </a>
                    &nbsp;&middot;&nbsp;
                    <a href="${url}/settings"
                       style="color:${T.textLight};text-decoration:underline;">
                      Unsubscribe
                    </a>
                  </p>
                </td>
                <td align="right" style="vertical-align:bottom;">
                  <p style="margin:0;font-size:11px;color:${T.textLight};
                             font-family:${T.font};">
                    &copy; ${year} ${app}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!-- ╚════════════════ CARD ════════════════╝ -->

    </td>
  </tr>
</table>

</body>
</html>`;
};

/* ─────────────────────────────────────────────────────────────
   Component helpers
───────────────────────────────────────────────────────────── */

/** Greeting line */
const greeting = (name: string): string => /* html */`
<p style="margin:0 0 22px;font-size:14px;color:${T.textMuted};font-family:${T.font};">
  Hi, <strong style="color:${T.textPrimary};">${name}</strong> 👋
</p>`;

/** Hero icon + headline + subtitle, centred */
const hero = (emoji: string, emojiBg: string, title: string, subtitle: string): string => /* html */`
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="margin-bottom:24px;">
  <tr>
    <td align="center">
      <div style="display:inline-block;width:66px;height:66px;border-radius:20px;
                  background:${emojiBg};text-align:center;line-height:66px;
                  font-size:30px;margin-bottom:18px;
                  box-shadow:0 2px 16px rgba(0,0,0,0.07);">
        ${emoji}
      </div>
      <h1 style="margin:0 0 10px;font-size:23px;font-weight:800;color:${T.textPrimary};
                 letter-spacing:-0.4px;line-height:1.25;font-family:${T.font};">
        ${title}
      </h1>
      <p style="margin:0;font-size:14px;color:${T.textMuted};line-height:1.7;
                max-width:380px;font-family:${T.font};">
        ${subtitle}
      </p>
    </td>
  </tr>
</table>`;

/** Horizontal rule */
const hr = (): string => /* html */`
<hr style="border:none;border-top:1px solid ${T.border};margin:26px 0;" />`;

/** Task info card */
const taskCard = (title: string, isUrgent = false, deadline?: string | null): string => /* html */`
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="margin:20px 0;">
  <tr>
    <td style="background:${isUrgent ? T.redBg : '#F0F6FF'};
               border:1px solid ${isUrgent ? T.redBorder : '#C7DCFF'};
               border-left:4px solid ${isUrgent ? T.red : T.cobalt};
               border-radius:10px;padding:16px 18px;">
      <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:0.1em;
                text-transform:uppercase;color:${isUrgent ? T.red : T.cobalt};
                font-family:${T.font};">
        ${isUrgent ? '⚡ Urgent Task' : '📋 Assigned Task'}
      </p>
      <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${T.textPrimary};
                line-height:1.4;font-family:${T.font};">
        ${title}
      </p>
      ${deadline ? `
      <div style="margin-top:12px;display:flex;align-items:center;">
        <span style="font-size:13px;color:${T.red};font-weight:600;font-family:${T.font};">
          ⏰ Due: ${deadline}
        </span>
      </div>` : ''}
      ${isUrgent ? `
      <div style="margin-top:10px;">
        <span style="display:inline-block;background:${T.red};color:#fff;
                     font-size:10px;font-weight:700;letter-spacing:0.07em;
                     text-transform:uppercase;padding:4px 12px;border-radius:20px;
                     font-family:${T.font};">
          High Priority
        </span>
      </div>` : ''}
    </td>
  </tr>
</table>`;

/** Leader note box */
const noteBox = (note: string): string => /* html */`
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="margin:18px 0;">
  <tr>
    <td style="background:${T.amberBg};border:1px solid ${T.amberBorder};
               border-radius:10px;padding:16px 18px;">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.1em;
                text-transform:uppercase;color:${T.amber};font-family:${T.font};">
        📝 &nbsp;Leader&rsquo;s Note
      </p>
      <p style="margin:0;font-size:14px;color:${T.textBody};line-height:1.7;
                font-style:italic;font-family:${T.font};">
        &ldquo;${note.trim()}&rdquo;
      </p>
    </td>
  </tr>
</table>`;

/** Success confirmation strip */
const successStrip = (msg: string): string => /* html */`
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="margin:18px 0;">
  <tr>
    <td style="background:${T.greenBg};border:1px solid ${T.greenBorder};
               border-radius:10px;padding:14px 18px;">
      <p style="margin:0;font-size:14px;font-weight:600;color:${T.green};
                font-family:${T.font};line-height:1.6;">
        ✅ &nbsp;${msg}
      </p>
    </td>
  </tr>
</table>`;

/** Large stat badge (count + label) */
const statBadge = (count: number, label: string): string => /* html */`
<table role="presentation" cellpadding="0" cellspacing="0"
       style="margin:0 auto 22px;">
  <tr>
    <td style="background:#EFF6FF;border:1px solid #BFDBFE;
               border-radius:14px;padding:14px 32px;text-align:center;">
      <div style="font-size:38px;font-weight:800;color:${T.cobalt};
                  line-height:1;margin-bottom:4px;font-family:${T.font};">
        ${count}
      </div>
      <div style="font-size:11px;font-weight:700;color:${T.cobalt};
                  letter-spacing:0.08em;text-transform:uppercase;
                  font-family:${T.font};">
        ${label}
      </div>
    </td>
  </tr>
</table>`;

/** Numbered pending task list */
const pendingList = (tasks: string[]): string => /* html */`
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="margin:20px 0;border:1px solid ${T.border};
              border-radius:12px;overflow:hidden;">
  ${tasks.map((t, i) => /* html */`
  <tr>
    <td style="padding:13px 18px;background:${T.cardBg};
               ${i < tasks.length - 1 ? `border-bottom:1px solid ${T.borderLight};` : ''}">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;padding-right:14px;">
            <div style="width:26px;height:26px;border-radius:7px;text-align:center;
                        line-height:26px;font-size:11px;font-weight:800;color:#fff;
                        background:linear-gradient(135deg,${T.cobalt} 0%,${T.teal} 100%);
                        font-family:${T.font};">
              ${i + 1}
            </div>
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:14px;font-weight:600;color:${T.textBody};
                         font-family:${T.font};line-height:1.5;">
              ${t}
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`).join('')}
</table>`;

/** CTA button */
const cta = (label: string, href: string, bg = T.cobalt): string => /* html */`
<table role="presentation" cellpadding="0" cellspacing="0"
       style="margin:30px auto 0;width:100%;">
  <tr>
    <td align="center">
      <a href="${href}"
         style="display:inline-block;background:${bg};color:#FFFFFF;
                font-size:15px;font-weight:700;text-decoration:none;
                padding:15px 46px;border-radius:50px;letter-spacing:0.02em;
                font-family:${T.font};
                box-shadow:0 4px 16px rgba(27,94,228,0.22);">
        ${label}
      </a>
    </td>
  </tr>
</table>`;

/** Centered helper text under CTA */
const helperText = (text: string): string => /* html */`
<p style="margin:16px 0 0;font-size:13px;color:${T.textMuted};
           text-align:center;line-height:1.7;font-family:${T.font};">
  ${text}
</p>`;

/* ─────────────────────────────────────────────────────────────
   Template builders
───────────────────────────────────────────────────────────── */

const buildAssignedEmail = (name: string, taskTitle: string, isUrgent: boolean, deadline?: string | null): string => {
  const btnBg = isUrgent ? T.red : T.cobalt;
  const body  = /* html */`
${greeting(name)}
${hero(
  isUrgent ? '⚡' : '📋',
  isUrgent ? T.redBg : '#EFF6FF',
  isUrgent ? 'Urgent task assigned to you' : 'You have a new task',
  isUrgent
    ? 'This has been flagged as high priority. Please start on it right away.'
    : 'Your team leader just assigned you a task. Jump in and get it done!',
)}
${taskCard(taskTitle, isUrgent, deadline)}
${hr()}
${helperText('Complete the task in the app and submit your proof for leader verification.')}
${cta(isUrgent ? 'Start Task Now &rarr;' : 'Open My Tasks &rarr;', cfg.appUrl(), btnBg)}`;

  return shell(body, { badgeLabel: isUrgent ? 'Urgent Task' : 'New Task' });
};

const buildTaskReminderEmail = (name: string, taskTitle: string, deadline: string): string => {
  const body = /* html */`
${greeting(name)}
${hero(
  '⏰',
  T.amberBg,
  'This task is due today!',
  'A friendly reminder that your assigned task is due by the end of today. Don\'t forget to submit your proof!',
)}
${taskCard(taskTitle, false, deadline)}
${hr()}
${helperText('Missing the deadline results in a 30% Perk penalty. Finish it up now!')}
${cta('Complete & Submit &rarr;', cfg.appUrl(), T.cobalt)}`;

  return shell(body, { badgeLabel: 'Task Due Today' });
};

const buildReassignedEmail = (name: string, taskTitle: string, leaderNote: string): string => {
  const body = /* html */`
${greeting(name)}
${hero(
  '🔁',
  T.amberBg,
  'Your submission needs a revision',
  'Your leader reviewed your work and sent it back for improvements. Take a look at the feedback below.',
)}
${taskCard(taskTitle)}
${leaderNote.trim() ? noteBox(leaderNote) : ''}
${hr()}
${helperText('Review the note, make your improvements, and resubmit. You\'ve got this!')}
${cta('Revise &amp; Resubmit &rarr;', cfg.appUrl(), T.amber)}`;

  return shell(body, { badgeLabel: 'Revision Required' });
};

const buildVerifiedEmail = (name: string, taskTitle: string): string => {
  const body = /* html */`
${greeting(name)}
${hero(
  '🎉',
  T.greenBg,
  'Your task has been verified!',
  'Your team leader reviewed your submission and gave it the green light. Brilliant work!',
)}
${successStrip('Submission officially verified and marked as complete.')}
${taskCard(taskTitle)}
${hr()}
${helperText('Check your dashboard to track your overall progress and pick up the next task.')}
${cta('View My Progress &rarr;', cfg.appUrl(), T.teal)}`;

  return shell(body, { badgeLabel: 'Task Verified' });
};

const buildReminderEmail = (name: string, pendingTasks: string[]): string => {
  const count  = pendingTasks.length;
  const single = count === 1;
  const body   = /* html */`
${greeting(name)}
${hero(
  '⏰',
  '#EFF6FF',
  single ? 'Just one task left!' : `${count} tasks still pending`,
  single
    ? 'You\'re so close — finish this last one and your board will be squeaky clean!'
    : 'Great progress so far! Let\'s push through and wrap these up.',
)}
${statBadge(count, count === 1 ? 'Task Remaining' : 'Tasks Remaining')}
${pendingList(pendingTasks)}
${hr()}
${helperText('Submit your proof inside the app once each task is complete.')}
${cta('Open My Tasks &rarr;', cfg.appUrl(), T.cobalt)}`;

  return shell(body, { badgeLabel: 'Friendly Reminder' });
};

/* ─────────────────────────────────────────────────────────────
   Public API — exported notification functions
───────────────────────────────────────────────────────────── */

export const notifyAssignedEmail = async (
  email: string | undefined,
  memberName: string,
  taskTitle: string,
  isUrgent: boolean,
  deadline?: string | null,
): Promise<boolean> => {
  if (!email) return false;
  const subject = isUrgent
    ? `⚡ [Urgent] New task assigned: ${taskTitle}`
    : `📋 New task assigned to you: ${taskTitle}`;
  return sendEmail(email, subject, buildAssignedEmail(memberName, taskTitle, isUrgent, deadline));
};

export const notifyTaskReminderEmail = async (
  email: string | undefined,
  memberName: string,
  taskTitle: string,
  deadline: string,
): Promise<boolean> => {
  if (!email) return false;
  return sendEmail(
    email,
    `⏰ Reminder: Task "${taskTitle}" is due today`,
    buildTaskReminderEmail(memberName, taskTitle, deadline)
  );
};

export const notifyReassignedEmail = async (
  email: string | undefined,
  memberName: string,
  taskTitle: string,
  leaderNote: string,
): Promise<boolean> => {
  if (!email) return false;
  return sendEmail(
    email,
    `🔁 Revision requested: ${taskTitle}`,
    buildReassignedEmail(memberName, taskTitle, leaderNote),
  );
};

export const notifyVerifiedEmail = async (
  email: string | undefined,
  memberName: string,
  taskTitle: string,
): Promise<boolean> => {
  if (!email) return false;
  return sendEmail(
    email,
    `🎉 Task verified: ${taskTitle}`,
    buildVerifiedEmail(memberName, taskTitle),
  );
};

export const notifyPendingReminderEmail = async (
  email: string | undefined,
  memberName: string,
  pendingTasks: string[],
): Promise<boolean> => {
  if (!email || pendingTasks.length === 0) return false;
  const subject = pendingTasks.length === 1
    ? `⏰ Reminder: "${pendingTasks[0]}" is still pending`
    : `⏰ Reminder: ${pendingTasks.length} tasks are waiting for you`;
  return sendEmail(email, subject, buildReminderEmail(memberName, pendingTasks));
};