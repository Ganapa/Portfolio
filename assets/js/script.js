const conversation = document.getElementById('conversation');
const form = document.getElementById('chat-form');
const input = document.getElementById('chat-input');
const suggestions = document.getElementById('suggestions');
const conversationStatus = document.getElementById('conversation-status');
const sendButton = form.querySelector('button[type="submit"]');
const themeToggle = document.getElementById('theme-toggle');
const themeToggleLabel = document.getElementById('theme-toggle-label');
const IS_LOCAL_DEVELOPMENT = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const PORTFOLIO_ASSIST_API_ENDPOINT = window.location.protocol === 'file:'
  ? ''
  : IS_LOCAL_DEVELOPMENT
    ? 'http://127.0.0.1:8787/api/chat'
    : 'https://portfolio-assist-api.nagappa-ganapa.workers.dev/api/chat';
const MAX_CONVERSATION_HISTORY = 8;
const MAX_HISTORY_MESSAGE_LENGTH = 1_000;
const MAX_HISTORY_BYTES = 5_000;
const API_REQUEST_TIMEOUT_MS = 30_000;
const CONVERSATION_SESSION_KEY = 'portfolio-assist-conversation-v1';

const conversationState = {
  isResponding: false,
  theme: 'light',
  typographyScaleIndex: 1,
  history: [],
  messages: [],
  sessionPersistenceUnavailable: false,
  restoreComplete: false,
  removedProjects: {}
};
let approvedContactLinks = [];

const portfolioContentContainer = document.getElementById('portfolio-content');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

function createAssistantSpeaker() {
  const speaker = document.createElement('div');
  speaker.className = 'speaker assistant-speaker';
  speaker.setAttribute('aria-label', 'Portfolio Assist');

  const image = document.createElement('img');
  image.src = 'assets/images/N assist.png';
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  speaker.appendChild(image);
  return speaker;
}

function sentenceCaseControlLabel(label) {
  const normalizedLabel = label.trim().toLowerCase();
  return normalizedLabel
    ? `${normalizedLabel[0].toUpperCase()}${normalizedLabel.slice(1)}`
    : '';
}

function applyTheme(theme) {
  conversationState.theme = theme;
  document.documentElement.dataset.theme = theme;
  themeColorMeta.content = theme === 'dark' ? '#171b20' : '#fbfaf9';
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
  themeToggle.setAttribute('aria-label', sentenceCaseControlLabel(`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`));
  themeToggleLabel.textContent = sentenceCaseControlLabel(theme === 'dark' ? 'Dark' : 'Light');
  themeToggle.querySelector('[data-theme-icon="light"]').hidden = theme === 'dark';
  themeToggle.querySelector('[data-theme-icon="dark"]').hidden = theme !== 'dark';
}

applyTheme(conversationState.theme);

themeToggle.addEventListener('click', () => {
  applyTheme(conversationState.theme === 'dark' ? 'light' : 'dark');
});

const typographyScales = [0.9, 1, 1.1, 1.2];

function applyTypographyRequest(action) {
  if (action === 'reset') {
    conversationState.typographyScaleIndex = 1;
    document.documentElement.style.setProperty('--typography-scale', typographyScales[1]);
    return 'Restored the original text size.';
  }

  if (action === 'easier') {
    conversationState.typographyScaleIndex = 2;
    document.documentElement.style.setProperty('--typography-scale', typographyScales[2]);
    return 'Set the text to the larger size for easier reading.';
  }

  const nextIndex = action === 'increase'
    ? Math.min(conversationState.typographyScaleIndex + 1, typographyScales.length - 1)
    : Math.max(conversationState.typographyScaleIndex - 1, 0);
  if (nextIndex === conversationState.typographyScaleIndex) {
    return action === 'increase'
      ? 'You’ve reached the largest supported text size.'
      : 'You’ve reached the smallest supported text size.';
  }

  conversationState.typographyScaleIndex = nextIndex;
  document.documentElement.style.setProperty('--typography-scale', typographyScales[nextIndex]);
  const scaleNames = ['smaller', 'original', 'larger', 'largest'];
  return `Set the text to the ${scaleNames[nextIndex]} size.`;
}

const approvedProjectDestinations = Object.freeze({
  forge: { href: 'https://www.figma.com/proto/FPwwTJM8aM257fEnIP8kyF/Napa?node-id=1907-34249&p=f&t=gcSmTDrd9yEohL0k-1&scaling=min-zoom&content-scaling=fixed&page-id=1158%3A7864&starting-point-node-id=1907%3A34249', target: '_blank' },
  medivera: { href: 'https://drive.google.com/file/d/1SvUVv20p1P5iwHuNJcsy0l0N3zMYmD-i/view?usp=drive_link', target: '_blank' },
  evolution: { href: 'https://www.figma.com/make/590ukvQriCTNpijYt0cjLL/Napa-UX-Evolution?code-node-id=0-9&p=f&t=T1WyZ8W8bRyWSmy4-0&fullscreen=1', target: '_blank' },
  'smart-implementation': { href: 'https://www.figma.com/make/590ukvQriCTNpijYt0cjLL/Napa-UX-Evolution?code-node-id=0-9&p=f&t=T1WyZ8W8bRyWSmy4-0&fullscreen=1&preview-route=%2Fwork', target: '_blank' },
});
const approvedProjectImages = Object.freeze({
  'time-off-policy-setup': { path: 'traditionalview/assets/images/time-off-hero.png', alt: 'Time Off policy setup experience' },
  'smart-implementation': { path: 'traditionalview/assets/images/project/adp-logo.webp', alt: 'ADP logo', kind: 'logo' },
  'total-rewards': { path: 'traditionalview/assets/images/project/adp-logo.webp', alt: 'ADP logo', kind: 'logo' },
  secutime: { path: 'traditionalview/assets/images/project/adp-logo.webp', alt: 'ADP logo', kind: 'logo' },
  medivera: { path: 'traditionalview/assets/images/project/Medivera.png', alt: 'Medivera project artwork' },
  forge: {
    path: 'traditionalview/assets/images/forge-design-system.webp',
    alt: 'Forge design system in Figma showing reusable components, form controls and design tokens'
  },
  'helios-insurance': { path: 'traditionalview/assets/images/project/helios-insurance-logo.webp', alt: 'Helios Insurance logo', kind: 'logo' },
  'singapore-cpfb': { path: 'traditionalview/assets/images/project/singapore-cpfb-logo.webp', alt: 'Singapore Central Provident Fund Board logo', kind: 'logo' },
  bdo: { path: 'traditionalview/assets/images/project/bdo-logo.webp', alt: 'BDO logo', kind: 'logo' },
  'world-bank': { path: 'traditionalview/assets/images/project/world-bank-logo.webp', alt: 'World Bank Group logo', kind: 'logo' },
  maersk: { path: 'traditionalview/assets/images/project/maersk-logo.webp', alt: 'MAERSK logo', kind: 'logo' },
  'crown-nest': { path: 'traditionalview/assets/images/project/crown-nest-logo.webp', alt: 'Crown Nest logo', kind: 'logo' },
  novartis: { path: 'traditionalview/assets/images/project/novartis-logo.webp', alt: 'Novartis logo', kind: 'logo' },
  'web-design-portfolio': { path: 'traditionalview/assets/images/web-design-projects.png', alt: 'Web design project examples' }
});

const displayedSections = new Map();
const knowledgeCache = new Map();
const APPROVED_PROJECT_IDS = new Set([
  'time-off-policy-setup', 'forge', 'medivera', 'evolution',
  'smart-implementation', 'total-rewards', 'secutime', 'ach-store',
  'helios-insurance', 'singapore-cpfb', 'bdo', 'world-bank', 'maersk',
  'crown-nest', 'novartis', 'web-design-portfolio'
]);
const PROJECT_ID_BY_NAME = new Map([
  ['time off', 'time-off-policy-setup'],
  ['smart implementation', 'smart-implementation'],
  ['total rewards', 'total-rewards'],
  ['secutime', 'secutime'],
  ['ach store', 'ach-store'],
  ['helios insurance', 'helios-insurance'],
  ['singapore cpfb', 'singapore-cpfb'],
  ['bdo', 'bdo'],
  ['world bank group', 'world-bank'],
  ['world bank', 'world-bank'],
  ['maersk', 'maersk'],
  ['crown nest', 'crown-nest'],
  ['novartis healthcare applications', 'novartis'],
  ['novartis', 'novartis'],
  ['web design development portfolio', 'web-design-portfolio'],
  ['web design portfolio', 'web-design-portfolio'],
  ['evolution', 'evolution'],
  ['design systems', 'forge'],
  ['design system', 'forge'],
  ['figma system', 'forge'],
  ['design tokens', 'forge'],
  ['forge', 'forge'],
  ['medivera', 'medivera'],
  ['ux audit', 'medivera'],
  ['ux audits', 'medivera']
]);
const PROJECT_IDS_BY_COMPANY = Object.freeze({
  sagarsoft: ['helios-insurance', 'web-design-portfolio'],
  tescra: ['ach-store'],
  neudesic: ['singapore-cpfb', 'bdo', 'world-bank', 'maersk', 'crown-nest'],
  liquidhub: ['novartis']
});
const APPROVED_PORTFOLIO_SECTION_IDS = new Set([
  'portfolio-topic-career',
  'portfolio-topic-skills',
  'portfolio-topic-design',
  'portfolio-topic-contact',
  'portfolio-topic-ai',
  'portfolio-topic-timeOff',
  'portfolio-topic-projects'
]);

function scrollToLatestMessage() {
  conversation.scrollTop = conversation.scrollHeight;
}

const LOCATION_REPLY = "I'm from the land of **Biryani**, where the magic comes from bringing the right spices and flavours together.\n\nI believe meaningful conversations work the same way. When different perspectives, ideas and experiences come together, they can create something truly special.";

function isLocationQuestion(text) {
  const normalized = normalizeQuery(text);
  return /\b(where are you from|where do you come from|where you from|where are you based|where do you live|where are you located|where do you stay|what is your location|whats your location|what s your location|your location|your hometown|which city do you live)\b/.test(normalized);
}

// Only the approved email address and LinkedIn URL from contact.json become links.
function appendLinkedText(element, value) {
  if (!approvedContactLinks.length) {
    element.appendChild(document.createTextNode(value));
    return;
  }
  const escaped = approvedContactLinks.map(link => link.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  value.split(new RegExp(`(${escaped.join('|')})`)).forEach(piece => {
    if (!piece) return;
    const approved = approvedContactLinks.find(link => link.text === piece);
    if (!approved) {
      element.appendChild(document.createTextNode(piece));
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = approved.href;
    anchor.textContent = approved.text;
    if (approved.href.startsWith('https://')) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
    element.appendChild(anchor);
  });
}

async function loadApprovedContactLinks() {
  const data = await loadKnowledgeDocument('contact');
  const links = [];
  if (typeof data.email?.address === 'string' && data.email.destination === `mailto:${data.email.address}`) {
    links.push({ text: data.email.address, href: data.email.destination });
  }
  if (typeof data.professionalProfile?.url === 'string' &&
      data.professionalProfile.url.startsWith('https://')) {
    links.push({ text: data.professionalProfile.url, href: data.professionalProfile.url });
  }
  approvedContactLinks = links;
}

function appendFormattedAssistantText(container, text) {
  const formattedLines = text.replace(/\s+\*\s+(?=\*\*)/g, '\n* ');
  let list = null;

  const appendInlineText = (element, value) => {
    const parts = value.split(/\*\*(.+?)\*\*/g);
    parts.forEach((part, index) => {
      if (!part) return;
      if (index % 2 === 1) {
        const strong = document.createElement('strong');
        strong.textContent = part;
        element.appendChild(strong);
      } else {
        appendLinkedText(element, part);
      }
    });
  };

  formattedLines.split(/\r?\n/).forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) {
      list = null;
      return;
    }

    const bullet = line.match(/^(?:[-*])\s+(.+)$/);
    if (bullet) {
      if (!list) {
        list = document.createElement('ul');
        container.appendChild(list);
      }
      const item = document.createElement('li');
      appendInlineText(item, bullet[1]);
      list.appendChild(item);
      return;
    }

    list = null;
    const paragraph = document.createElement('p');
    appendInlineText(paragraph, line);
    container.appendChild(paragraph);
  });
}

function normalizeQuery(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function identifyPortfolioTopic(query, history = []) {
  const normalized = normalizeQuery(query);
  if (/\b(time off|leave policy|case study|case studies)\b/.test(normalized)) return 'timeOff';
  if (/\b(ai|artificial intelligence|human ai|conversational ai)\b/.test(normalized)) return 'ai';
  if (/\b(career|career journey|career timeline|timeline|journey|work experience|professional background|employment history|my experience|your experience|career history|where have i worked|companies have i worked|what companies have i worked|company history|companies worked|worked for)\b/.test(normalized)) return 'career';
  if (/\b(skills|skill set|capabilities|expertise|technical skills)\b/.test(normalized)) return 'skills';
  if (/\b(design approach|approach design|approach to design|design philosophy|mesh|design principles|principles|accessibility approach|approach to accessibility|about accessibility|think about accessibility)\b/.test(normalized)) return 'design';
  if (/\b(contact|email|linkedin|reach you|reach out|get in touch|connect with you|connect professionally|connect with me)\b/.test(normalized)) return 'contact';
  if (/\b(project|projects|portfolio work|show me my work|my work|what work|work i have done|ux audit|healthcare|government|insurance|logistics|enterprise ux)\b/.test(normalized)) return 'projects';

  if (!/\b(it|that|those|them|more|tell me more|what about|and)\b/.test(normalized)) return null;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role === 'user') return identifyPortfolioTopic(history[index].text);
  }
  return null;
}

function identifyProjectId(query) {
  const normalized = normalizeQuery(query);
  for (const [name, id] of PROJECT_ID_BY_NAME) {
    if (` ${normalized} `.includes(` ${name} `)) return id;
  }
  return null;
}

function resolveDisplayTopic(query, history = []) {
  const normalized = normalizeQuery(query);
  const topic = identifyPortfolioTopic(query, history);
  const projectId = identifyProjectId(query);
  // A generic "design system" mention inside a skills, design or career question is not a Forge request.
  const genericDesignSystem = projectId === 'forge' && !/\bforge\b/.test(normalized);
  if (projectId && !(genericDesignSystem && ['skills', 'design', 'career', 'contact'].includes(topic))) {
    return projectId === 'time-off-policy-setup'
      ? { topic: 'timeOff', projectId }
      : { topic: 'projectDetail', projectId };
  }
  return { topic, projectId: null };
}

function getTopicSourceQuery(query, history) {
  if (identifyPortfolioTopic(query) || identifyProjectId(query)) return query;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role === 'user' && identifyPortfolioTopic(history[index].text)) {
      return history[index].text;
    }
  }
  return query;
}

async function loadKnowledgeDocument(name) {
  if (!knowledgeCache.has(name)) {
    knowledgeCache.set(name, fetch(new URL(`knowledge/${name}.json`, window.location.href), { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error(`Could not load approved ${name} knowledge (${response.status}).`);
        return response.json();
      }));
  }
  return knowledgeCache.get(name);
}

function textBlock(label, value) {
  return typeof value === 'string' && value.trim() ? { label, text: value } : null;
}

function listBlock(label, values) {
  return Array.isArray(values) && values.length && values.every(value => typeof value === 'string')
    ? { label, items: values }
    : null;
}

function buildProjectEntry(project) {
  const projectSummary = project.id === 'evolution'
    ? 'Exploration of traditional UX to AI-powered UX. Exploring how UX moves beyond traditional screen-based workflows into adaptive AI-powered experiences.'
    : project.summary;
  return {
    id: `project-${project.id}`,
    projectId: project.id,
    title: project.name,
    type: project.classification || project.productArea,
    summary: projectSummary,
    defaultExpanded: false,
    ...(project.id === 'evolution' ? { presentation: 'evolution' } : {}),
    ...(project.id === 'forge' ? {
      presentation: 'forge',
      features: [
        { title: 'UI components', description: project.details[0] },
        { title: 'Visual foundations', description: project.details[1] },
        { title: 'Accessibility', description: project.details[2] },
        { title: 'Documentation', description: project.details[3] }
      ],
      tags: ['Design tokens', 'Independent initiative', 'Figma']
    } : {}),
    image: approvedProjectImages[project.id]
      ? {
        ...approvedProjectImages[project.id],
        src: new URL(approvedProjectImages[project.id].path, window.location.href).href
      }
      : null,
    blocks: [
      textBlock('Project overview', project.overview),
      textBlock('Product area', project.productArea),
      textBlock(project.id === 'forge' ? 'The thinking behind Forge' : 'Project story', project.story),
      ...(project.id === 'forge' ? [] : [listBlock('Project details', project.details)]),
      listBlock(
        project.id === 'time-off-policy-setup'
          ? 'My role and responsibilities'
          : 'Key Responsibilities',
        project.responsibilities
      ),
      textBlock('Documented outcomes', project.outcome)
    ].filter(Boolean),
    links: approvedProjectDestinations[project.id]
      ? [{
        label: project.id === 'evolution'
          ? 'Explore evolution'
          : project.id === 'smart-implementation'
            ? 'Explore smart implementation'
            : 'View project',
        ...( ['evolution', 'smart-implementation', 'forge', 'medivera'].includes(project.id)
          ? { icon: 'bi-box-arrow-up-right' }
          : {}),
        ...approvedProjectDestinations[project.id]
      }]
      : []
  };
}

async function loadProjectData() {
  const data = await loadKnowledgeDocument('projects');
  if (!Array.isArray(data.projects)) throw new Error('Approved project data is incomplete.');
  return data.projects.filter(project => APPROVED_PROJECT_IDS.has(project.id));
}

async function loadTimeOffCaseStudy() {
  const sourceUrl = new URL('traditionalview/my-journey.html', window.location.href);
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Could not load the approved Time Off case study (${response.status}).`);

  const sourceDocument = new DOMParser().parseFromString(await response.text(), 'text/html');
  const caseStudy = sourceDocument.querySelector('#timeOffCaseStudy .case-study-layout');
  if (!caseStudy || !caseStudy.querySelector('.case-study-content')) {
    throw new Error('The approved Time Off case study content is incomplete.');
  }
  return caseStudy;
}

async function loadTraditionalViewPosts() {
  const sourceUrl = new URL('traditionalview/index.html', window.location.href);
  const response = await fetch(sourceUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load Traditional View posts (${response.status}).`);

  const sourceDocument = new DOMParser().parseFromString(await response.text(), 'text/html');
  const ideasSection = sourceDocument.querySelector('#ideas');
  if (!ideasSection) throw new Error('Traditional View is missing its ideas and experiments section.');

  return [...ideasSection.querySelectorAll('.ideas-card')].map((card, index) => {
    const sourceLink = card.querySelector('.ideas-card-content .ideas-link');
    const description = card.querySelector('.ideas-card-content p')?.textContent.trim();
    const href = sourceLink?.getAttribute('href')?.trim();
    const sourceImage = card.querySelector('.ideas-image');
    const imagePath = sourceImage?.getAttribute('src');
    const imageUrl = imagePath ? new URL(imagePath, sourceUrl) : null;

    if (!href?.startsWith('https://') || !description) {
      throw new Error(`Traditional View post ${index + 1} is missing its link or description.`);
    }
    if (imageUrl && (imageUrl.origin !== window.location.origin ||
        !imageUrl.pathname.includes('/traditionalview/assets/images/'))) {
      throw new Error(`Traditional View post ${index + 1} references an unapproved image.`);
    }

    return {
      description,
      href,
      label: sourceLink.textContent.trim(),
      ...(imageUrl ? {
        image: {
          src: imageUrl.href,
          alt: sourceImage.alt.trim()
        }
      } : {})
    };
  });
}

async function buildPortfolioDisplay(topic, query, projectId = null) {
  if (topic === 'timeOff') {
    return {
      id: 'portfolio-topic-timeOff',
      title: 'Time Off case study',
      projectId: 'time-off-policy-setup',
      summary: 'Redesigned policy configuration workflows using structured information and recommendations to reduce implementation complexity and turnaround time.',
      type: 'Complete case study',
      defaultExpanded: true,
      caseStudy: await loadTimeOffCaseStudy()
    };
  }

  if (topic === 'career') {
    const [data, projects] = await Promise.all([
      loadKnowledgeDocument('career'),
      loadProjectData()
    ]);
    if (!Array.isArray(data.experience) || data.experience.length !== 7) throw new Error('Approved career timeline data is incomplete.');
    return {
      id: 'portfolio-topic-career',
      title: 'Career timeline',
      entries: await Promise.all(data.experience.map(async (entry, index) => ({
        id: `career-entry-${index + 1}`,
        title: entry.company,
        type: entry.designation,
        blocks: [
          textBlock('Period', entry.period),
          textBlock('Location', entry.location),
          textBlock('Client', entry.client),
          textBlock('Client context', entry.clientContext),
          ...(Array.isArray(entry.overview)
            ? entry.overview.map((text, paragraphIndex) => textBlock(`Overview ${paragraphIndex + 1}`, text))
            : [textBlock('Overview', entry.overview)]),
          listBlock('Responsibilities', entry.responsibilities),
          listBlock('Additional contributions', entry.additionalContributions)
        ].filter(Boolean),
        projectEntries: (await Promise.all((entry.projects || []).map(async name => {
          const projectId = PROJECT_ID_BY_NAME.get(normalizeQuery(name));
          const project = projects.find(candidate => candidate.id === projectId);
          if (!project || !APPROVED_PROJECT_IDS.has(project.id)) return null;
          const projectEntry = buildProjectEntry(project);
          if (project.id === 'time-off-policy-setup') {
            projectEntry.caseStudy = await loadTimeOffCaseStudy();
            projectEntry.blocks = [];
            projectEntry.image = null;
          }
          return projectEntry;
        }))).filter(Boolean),
        unlinkedProjects: (entry.projects || []).filter(name =>
          !PROJECT_ID_BY_NAME.has(normalizeQuery(name))
        )
      })))
    };
  }

  if (topic === 'skills') {
    const data = await loadKnowledgeDocument('skills');
    if (!Array.isArray(data.categories) || data.categories.length !== 7) throw new Error('Approved skills data is incomplete.');
    return {
      id: 'portfolio-topic-skills',
      title: 'Skills',
      entries: data.categories.map((category, index) => ({
        id: `skill-category-${index + 1}`,
        title: category.name,
        blocks: [listBlock('Skills', category.skills)].filter(Boolean)
      }))
    };
  }

  if (topic === 'design') {
    const data = await loadKnowledgeDocument('design-philosophy');
    return {
      id: 'portfolio-topic-design',
      title: 'Design philosophy',
      entries: [{
        id: 'design-philosophy-summary',
        title: 'Design philosophy',
        blocks: [
          ...data.coreStatements.map((text, index) => textBlock(`Statement ${index + 1}`, text)),
          ...data.principles.map((principle, index) => ({
            id: `design-principle-${index + 1}`,
            title: principle.name,
            blocks: [textBlock('Principle', principle.description)].filter(Boolean)
          })),
          { id: 'mesh-principles', title: data.meshPrinciples.name, blocks: [listBlock('Principles', data.meshPrinciples.principles)].filter(Boolean) },
          { id: 'experience-qualities', title: 'Core experience qualities', blocks: [listBlock('Qualities', data.coreExperienceQualities)].filter(Boolean) },
          { id: 'design-approach', title: 'Design approach', blocks: [listBlock('Approach', data.designApproach)].filter(Boolean) }
        ].filter(Boolean)
      }]
    };
  }

  if (topic === 'contact') {
    const [data, posts] = await Promise.all([
      loadKnowledgeDocument('contact'),
      loadTraditionalViewPosts()
    ]);
    return {
      id: 'portfolio-topic-contact',
      title: 'Contact',
      entries: [{
        id: 'contact-details',
        title: 'Get in touch',
        contactMethods: [
          {
            label: 'Email',
            value: data.email.address,
            href: data.email.destination,
            action: 'Send email',
            icon: 'bi-envelope'
          },
          {
            label: 'LinkedIn',
            value: data.professionalProfile.url,
            href: data.professionalProfile.url,
            action: 'View linkedin profile',
            icon: 'bi-linkedin'
          }
        ],
        posts,
      }]
    };
  }

  const projects = await loadProjectData();
  if (topic === 'projectDetail') {
    const project = projects.find(candidate => candidate.id === projectId);
    if (!project) throw new Error('The requested project is not in the approved portfolio.');
    const entry = buildProjectEntry(project);
    entry.defaultExpanded = true;
    if (project.id === 'medivera') {
      // Medivera is shown as a plain "UX audit" card rather than an accordion titled with the project name.
      entry.presentation = 'audit';
      if (entry.image) entry.image.kind = 'natural';
    }
    if (project.id === 'time-off-policy-setup') entry.caseStudy = await loadTimeOffCaseStudy();
    return {
      id: `portfolio-project-detail-${project.id}`,
      title: project.id === 'forge' ? 'Design system' : project.id === 'medivera' ? 'UX audit' : project.name,
      projectDetail: true,
      entries: [entry]
    };
  }

  const normalized = normalizeQuery(query);
  const companyFilter = Object.entries(PROJECT_IDS_BY_COMPANY)
    .find(([company]) => new RegExp(`\\b${company}\\b`).test(normalized));
  const entries = projects
    .filter(project => {
      if (topic === 'ai') return ['smart-implementation', 'evolution'].includes(project.id);
      if (topic !== 'projects') return false;
      // Forge and the UX audit have their own sections, so the overview omits them.
      if (['forge', 'medivera'].includes(project.id)) return false;
      if (companyFilter) return companyFilter[1].includes(project.id);
      return /\b(all|projects|portfolio|work|audit|healthcare|government|insurance|logistics|enterprise)\b/.test(normalized) ||
        (` ${normalized} `).includes(` ${normalizeQuery(project.name)} `);
    })
    .map(buildProjectEntry);
  if (topic === 'ai') entries.forEach(entry => { entry.defaultExpanded = true; });
  if (entries.some(entry => entry.projectId === 'time-off-policy-setup')) {
    entries.find(entry => entry.projectId === 'time-off-policy-setup').caseStudy = await loadTimeOffCaseStudy();
  }

  return {
    id: `portfolio-topic-${topic}`,
    title: topic === 'ai' ? 'AI experience' : topic === 'timeOff' ? 'Time Off case study' : 'Projects',
    entries
  };
}

function createCaseStudyHost(caseStudy) {
  const caseStudyHost = document.createElement('div');
  caseStudyHost.className = 'portfolio-case-study-host';
  const shadowRoot = caseStudyHost.attachShadow({ mode: 'open' });

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('traditionalview/assets/css/style.css', window.location.href).href;
  shadowRoot.appendChild(stylesheet);

  const iconStylesheet = document.createElement('link');
  iconStylesheet.rel = 'stylesheet';
  iconStylesheet.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css';
  shadowRoot.appendChild(iconStylesheet);

  const caseStudyStyle = document.createElement('style');
  caseStudyStyle.textContent = `
    :host { display: block; color: var(--body-ink); }
    .case-study-layout { display: block; height: auto; min-height: 0; overflow: visible; }
    .project-sidebar { position: static; height: auto; overflow: visible; margin-bottom: 24px; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; }
    .case-study-content { height: auto; overflow: visible; padding: clamp(16px, 3vw, 40px); border-radius: 12px; background: #fcfcfc; }
    .case-study-content img { display: block; width: 100% !important; max-width: 100% !important; max-height: none !important; height: auto !important; object-fit: contain !important; }
    .case-study-content > :is(section, .design-process-heading, .prototype-gallery) { margin-block: clamp(24px, 4vw, 44px); }
    .case-study-content :is(p, li) { line-height: 1.6; }
    .case-study-content :is(.discovery-research-image, .solution-before-image, .solution-after-image, .impact-image) { display: block; width: 100%; max-width: 100%; height: auto; object-fit: contain; }
    .case-study-content .user-journey-section { padding: clamp(16px, 2.5vw, 32px); }
    .timeoff-hero { grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); }
    .prototype-gallery { grid-template-columns: minmax(0, 1fr); grid-template-areas: none; }
    .prototype-gallery > .user-journey-section { grid-area: auto; }
    img { display: block; width: 100%; max-width: 100%; height: auto; object-fit: contain; }
    table { width: 100%; }
    .user-journey-table-wrapper { max-width: 100%; overflow-x: auto; }
    :host-context(html[data-theme="dark"]) .case-study-layout { color: #202a31; }
    :host-context(html[data-theme="dark"]) .case-study-layout :is(.project-sidebar, .user-journey-section, .problem-card, .research-solution-card, .solution-comparison-card, .decision-cell, .impact-card, .learning-card, .validation-check-card, .client-notes-preview, .validation-preview) { background-color: #f7f5f3; }
    :host-context(html[data-theme="dark"]) .case-study-layout :is(h1, h2, h3, h4, p, li, th, td, strong, span, cite, .project-detail, .project-sidebar-heading, .user-journey-header) { color: #202a31 !important; }
    @media (max-width: 700px) {
      .project-sidebar { padding: 16px; }
      .timeoff-hero { grid-template-columns: minmax(0, 1fr); }
    }
  `;
  shadowRoot.appendChild(caseStudyStyle);

  const permittedElements = new Set([
    'A', 'ARTICLE', 'BLOCKQUOTE', 'BR', 'CITE', 'DIV', 'FIGCAPTION',
    'FIGURE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'I', 'IMG', 'LI',
    'OL', 'P', 'SECTION', 'SPAN', 'STRONG', 'TABLE', 'TBODY', 'TD',
    'TH', 'THEAD', 'TR', 'UL'
  ]);
  const sourceBase = new URL('traditionalview/my-journey.html', window.location.href);

  const copyDocumentedNode = (sourceNode, destination) => {
    if (sourceNode.nodeType === Node.TEXT_NODE) {
      destination.appendChild(document.createTextNode(sourceNode.nodeValue || ''));
      return;
    }
    if (!(sourceNode instanceof Element)) return;
    if (!permittedElements.has(sourceNode.tagName)) {
      if (['BUTTON', 'SCRIPT', 'STYLE', 'SVG'].includes(sourceNode.tagName)) return;
      for (const child of sourceNode.childNodes) copyDocumentedNode(child, destination);
      return;
    }

    const copiedNode = document.createElement(sourceNode.tagName.toLowerCase());
    const classes = [...sourceNode.classList].filter(name => /^[a-zA-Z0-9_-]+$/.test(name));
    if (classes.length) copiedNode.className = classes.join(' ');

    if (sourceNode.tagName === 'IMG') {
      const source = sourceNode.getAttribute('src');
      if (!source) return;
      const imageUrl = new URL(source, sourceBase);
      if (imageUrl.origin !== window.location.origin ||
          !imageUrl.pathname.includes('/traditionalview/assets/images/')) return;
      copiedNode.src = imageUrl.href;
      copiedNode.alt = sourceNode.getAttribute('alt') || '';
      copiedNode.loading = 'lazy';
      for (const dimension of ['width', 'height']) {
        const value = sourceNode.getAttribute(dimension);
        if (value && /^\d+$/.test(value)) copiedNode.setAttribute(dimension, value);
      }
    } else if (sourceNode.tagName === 'A') {
      const linkUrl = new URL(sourceNode.getAttribute('href') || '', sourceBase);
      if (linkUrl.origin !== window.location.origin) return;
      copiedNode.href = linkUrl.href;
    } else if (sourceNode.tagName === 'I') {
      copiedNode.setAttribute('aria-hidden', 'true');
    } else {
      for (const attribute of ['scope', 'colspan', 'rowspan', 'aria-label']) {
        const value = sourceNode.getAttribute(attribute);
        if (value) copiedNode.setAttribute(attribute, value);
      }
    }

    for (const child of sourceNode.childNodes) copyDocumentedNode(child, copiedNode);
    destination.appendChild(copiedNode);
  };

  const caseStudyLayout = document.createElement('div');
  caseStudyLayout.className = 'case-study-layout';
  for (const child of caseStudy.childNodes) copyDocumentedNode(child, caseStudyLayout);
  shadowRoot.appendChild(caseStudyLayout);
  return caseStudyHost;
}

function findPortfolioSection(content) {
  return document.getElementById(content.id);
}

function createProjectAccordion(item, entry, expanded = false) {
  const projectId = entry.projectId;
  const toggle = document.createElement('button');
  toggle.className = 'portfolio-project-toggle';
  toggle.type = 'button';
  toggle.id = `${item.id}-toggle`;
  toggle.dataset.projectId = projectId;
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.setAttribute('aria-controls', `${item.id}-details`);

  const heading = document.createElement('span');
  heading.className = 'portfolio-project-title';
  heading.textContent = sentenceCaseControlLabel(entry.title);
  toggle.appendChild(heading);

  if (entry.type) {
    const category = document.createElement('span');
    category.className = 'portfolio-project-category';
    category.textContent = entry.type;
    toggle.appendChild(category);
  }

  if (entry.summary) {
    const summary = document.createElement('span');
    summary.className = 'portfolio-project-summary';
    summary.textContent = entry.summary;
    toggle.appendChild(summary);
  }

  const indicator = document.createElement('span');
  indicator.className = 'portfolio-project-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.textContent = expanded ? '−' : '+';
  toggle.appendChild(indicator);

  const panel = document.createElement('div');
  panel.className = 'portfolio-project-panel';
  panel.id = `${item.id}-details`;
  panel.hidden = !expanded;

  item.classList.add('portfolio-project-accordion');
  item.dataset.projectId = projectId;
  item.append(toggle, panel);
  return { toggle, panel };
}

function appendEvolutionProgression(parent) {
  const progression = document.createElement('section');
  progression.className = 'evolution-progression';
  progression.setAttribute('aria-label', 'Conceptual progression in user experience');

  const heading = document.createElement('h4');
  heading.textContent = 'A conceptual progression in UX';
  progression.appendChild(heading);

  const stages = [
    {
      title: 'Traditional UX',
      points: [
        'Fixed screens and interfaces.',
        'Menus, buttons and navigation.',
        'Predefined user workflows.',
        'Users manually navigate through product interactions.'
      ]
    },
    {
      title: 'AI-assisted UX',
      points: [
        'Contextual assistance.',
        'AI-supported recommendations.',
        'Intelligent interactions.',
        'Support for users within existing workflows.'
      ]
    },
    {
      title: 'Adaptive AI-powered UX',
      points: [
        'Experiences that respond to user needs and context.',
        'Adaptive interactions.',
        'More contextual and flexible experiences.',
        'Human control and user choice remain important design considerations.'
      ]
    }
  ];

  const stagesContainer = document.createElement('div');
  stagesContainer.className = 'evolution-progression-stages';
  stages.forEach((stage, index) => {
    const stageCard = document.createElement('article');
    stageCard.className = 'evolution-progression-stage';
    const stageHeading = document.createElement('h5');
    stageHeading.textContent = `${index + 1}. ${stage.title}`;
    const list = document.createElement('ul');
    stage.points.forEach(point => {
      const item = document.createElement('li');
      item.textContent = point;
      list.appendChild(item);
    });
    stageCard.append(stageHeading, list);
    stagesContainer.appendChild(stageCard);
  });
  progression.appendChild(stagesContainer);

  const note = document.createElement('p');
  note.className = 'evolution-progression-note';
  note.textContent = 'This progression is a conceptual presentation framework. It does not claim that every product follows these stages or that all described capabilities were implemented in this project.';
  progression.appendChild(note);
  parent.appendChild(progression);
}

// Approved Medivera UX audit copy, supplied by the portfolio owner.
const AUDIT_CONTENT = {
  statement: 'Improving healthcare experiences through better usability, accessibility and workflows.',
  about: [
    'Medivera is a UX audit focused on identifying usability issues, accessibility gaps and opportunities to improve healthcare workflows.',
    'The goal was to understand where the experience could be clearer, easier to use and more effective for people interacting with the product.'
  ],
  focus: [
    { icon: 'bi-ui-checks-grid', title: 'Usability', text: 'Identifying usability issues that affect how people interact with the experience.' },
    { icon: 'bi-universal-access', title: 'Accessibility', text: 'Identifying accessibility gaps and opportunities to make the experience more inclusive.' },
    { icon: 'bi-diagram-3', title: 'Workflow improvements', text: 'Identifying opportunities to simplify workflows and improve the overall experience.' }
  ],
  objective: 'Support better healthcare experiences by turning UX audit observations into actionable improvement recommendations.'
};

function appendAuditContent(parent) {
  const statement = document.createElement('p');
  statement.className = 'audit-statement';
  statement.textContent = AUDIT_CONTENT.statement;

  const about = document.createElement('div');
  about.className = 'audit-block';
  const aboutHeading = document.createElement('h4');
  aboutHeading.textContent = 'About the project';
  about.appendChild(aboutHeading);
  AUDIT_CONTENT.about.forEach(text => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    about.appendChild(paragraph);
  });

  const focus = document.createElement('div');
  focus.className = 'audit-block';
  const focusHeading = document.createElement('h4');
  focusHeading.textContent = 'Audit focus';
  const focusGrid = document.createElement('div');
  focusGrid.className = 'audit-focus-grid';
  AUDIT_CONTENT.focus.forEach(area => {
    const card = document.createElement('article');
    card.className = 'audit-focus-item';
    const icon = document.createElement('i');
    icon.className = `bi ${area.icon}`;
    icon.setAttribute('aria-hidden', 'true');
    const title = document.createElement('h5');
    title.textContent = area.title;
    const text = document.createElement('p');
    text.textContent = area.text;
    card.append(icon, title, text);
    focusGrid.appendChild(card);
  });
  focus.append(focusHeading, focusGrid);

  const objective = document.createElement('div');
  objective.className = 'audit-block';
  const objectiveHeading = document.createElement('h4');
  objectiveHeading.textContent = 'Project objective';
  const objectiveText = document.createElement('p');
  objectiveText.textContent = AUDIT_CONTENT.objective;
  objective.append(objectiveHeading, objectiveText);

  parent.append(statement, about, focus, objective);
}

function renderPortfolioSection(content, persist = true) {
  const existingSection = findPortfolioSection(content);
  if (existingSection) {
    return false;
  }

  const section = document.createElement('section');
  section.className = 'portfolio-section';
  const sectionStyle = {
    'portfolio-topic-career': 'career',
    'portfolio-topic-skills': 'skills',
    'portfolio-topic-design': 'design',
    'portfolio-topic-projects': 'projects',
    'portfolio-topic-ai': 'ai',
    'portfolio-topic-contact': 'contact'
  }[content.id];
  if (sectionStyle) section.classList.add(`portfolio-section--${sectionStyle}`);
  if (content.projectDetail || content.id.startsWith('portfolio-project-detail-')) {
    section.classList.add('portfolio-section--project-detail');
  }
  section.id = content.id;
  section.setAttribute('aria-labelledby', `${content.id}-title`);

  const sectionHeader = document.createElement('div');
  sectionHeader.className = 'portfolio-section-header';

  const heading = document.createElement('h2');
  heading.id = `${content.id}-title`;
  heading.textContent = content.title;

  const removeButton = document.createElement('button');
  removeButton.className = 'portfolio-section-remove';
  removeButton.type = 'button';
  removeButton.setAttribute('aria-label', sentenceCaseControlLabel(`Remove ${content.title}`));
  removeButton.textContent = 'Remove section';

  sectionHeader.append(heading, removeButton);
  section.append(sectionHeader);

  if (content.caseStudy) {
    section.classList.add('portfolio-section--project-detail');
    const timeOffCard = document.createElement('article');
    timeOffCard.className = 'portfolio-entry';
    timeOffCard.id = `portfolio-project-${content.projectId}-${content.id}`;
    const accordion = createProjectAccordion(timeOffCard, content, content.defaultExpanded);
    accordion.panel.appendChild(createCaseStudyHost(content.caseStudy));
    section.appendChild(timeOffCard);
  } else {
    const appendEntry = (parent, entry, nested = false) => {
      const item = document.createElement(nested ? 'section' : 'article');
      const aiProject = section.classList.contains('portfolio-section--ai') && Boolean(entry.projectId);
      const forgeProject = entry.presentation === 'forge';
      const auditProject = entry.presentation === 'audit';
      const directProject = aiProject || forgeProject || auditProject;
      item.className = directProject
        ? 'portfolio-entry portfolio-ai-project'
        : nested ? 'portfolio-entry portfolio-entry-nested' : 'portfolio-entry';
      item.id = entry.projectId
        ? `portfolio-project-${entry.projectId}-${section.id}-${entry.id}`
        : entry.id;
      let itemContent = item;

      if (directProject) {
        item.dataset.projectId = entry.projectId;
        if (!auditProject) {
          const title = document.createElement('h3');
          title.className = 'portfolio-project-title';
          title.textContent = entry.title;
          item.appendChild(title);
        }

        if (entry.type && !auditProject) {
          const category = document.createElement('span');
          category.className = 'portfolio-project-category';
          category.textContent = entry.type;
          item.appendChild(category);
        }

        if (auditProject) {
          item.classList.add('portfolio-audit-card');
          appendAuditContent(item);
        } else if (entry.summary) {
          const summary = document.createElement('p');
          summary.className = 'portfolio-project-summary';
          summary.textContent = entry.summary;
          item.appendChild(summary);
        }
      } else if (entry.projectId) {
        const accordion = createProjectAccordion(item, entry, Boolean(entry.defaultExpanded));
        if (section.classList.contains('portfolio-section--career')) {
          item.classList.add('career-project-accordion');
        }
        itemContent = accordion.panel;
      }

      if (entry.title && !entry.projectId) {
        const itemTitle = document.createElement(nested ? 'h4' : 'h3');
        itemTitle.textContent = entry.title;
        item.appendChild(itemTitle);
      }

      if (entry.type && !entry.projectId) {
        const itemType = document.createElement('p');
        itemType.className = 'portfolio-section-type';
        itemType.textContent = entry.type;
        item.appendChild(itemType);
      }

      if (entry.image && typeof entry.image.src === 'string' && !auditProject) {
        const image = document.createElement('img');
        image.className = `portfolio-project-image${entry.image.kind === 'logo' ? ' portfolio-project-image--logo' : ''}${entry.image.kind === 'natural' ? ' portfolio-project-image--natural' : ''}`;
        image.src = entry.image.src;
        image.alt = entry.image.alt;
        image.loading = 'eager';
        image.hidden = true;
        image.addEventListener('load', () => {
          if (image.naturalWidth > 0) image.hidden = false;
          else image.remove();
        }, { once: true });
        image.addEventListener('error', () => image.remove(), { once: true });
        itemContent.appendChild(image);
        if (image.complete) {
          if (image.naturalWidth > 0) image.hidden = false;
          else image.remove();
        }
      }

      const renderDetail = block => {
        if (block.title && Array.isArray(block.blocks)) {
          appendEntry(item, block, true);
          return;
        }

        const blockElement = document.createElement('div');
        blockElement.className = 'portfolio-detail';
        if (block.label) {
          blockElement.dataset.label = block.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const label = document.createElement('h4');
          label.textContent = block.label;
          blockElement.appendChild(label);
        }
        if (typeof block.text === 'string') {
          const paragraph = document.createElement('p');
          paragraph.textContent = block.text;
          blockElement.appendChild(paragraph);
        }
        if (Array.isArray(block.items)) {
          const list = document.createElement('ul');
          if (section.classList.contains('portfolio-section--skills') ||
              (section.classList.contains('portfolio-section--design') &&
               ['mesh-principles', 'experience-qualities'].includes(entry.id))) {
            list.className = 'portfolio-chip-list';
            list.setAttribute('aria-label', block.label || entry.title || 'Items');
          }
          block.items.forEach(value => {
            if (typeof value !== 'string') return;
            const listItem = document.createElement('li');
            listItem.textContent = value;
            if (list.classList.contains('portfolio-chip-list')) listItem.setAttribute('role', 'listitem');
            list.appendChild(listItem);
          });
          blockElement.appendChild(list);
        }
        if (blockElement.childElementCount) itemContent.appendChild(blockElement);
      };

      if (entry.presentation === 'forge') {
        const featureSection = document.createElement('section');
        featureSection.className = 'forge-project-features';
        featureSection.setAttribute('aria-label', 'Forge design system features');
        const features = document.createElement('div');
        features.className = 'forge-project-feature-grid';
        (entry.features || []).forEach(feature => {
          const card = document.createElement('article');
          card.className = 'forge-project-feature';
          const title = document.createElement('h4');
          title.textContent = feature.title;
          const description = document.createElement('p');
          description.textContent = feature.description;
          card.append(title, description);
          features.appendChild(card);
        });
        featureSection.appendChild(features);

        if (Array.isArray(entry.tags) && entry.tags.length) {
          const tags = document.createElement('ul');
          tags.className = 'forge-project-tags';
          tags.setAttribute('aria-label', 'Forge project attributes');
          entry.tags.forEach(tag => {
            const item = document.createElement('li');
            item.textContent = tag;
            tags.appendChild(item);
          });
          featureSection.appendChild(tags);
        }
        itemContent.appendChild(featureSection);
      }

      const careerMetadata = section.classList.contains('portfolio-section--career')
        ? document.createElement('div')
        : null;
      if (careerMetadata) careerMetadata.className = 'career-metadata';

      for (const block of entry.blocks || []) {
        if (careerMetadata && ['period', 'location'].includes(block.label?.toLowerCase())) {
          renderDetail(block);
          const metadataBlock = itemContent.lastElementChild;
          if (metadataBlock) careerMetadata.appendChild(metadataBlock);
          continue;
        }
        renderDetail(block);
      }
      if (careerMetadata?.childElementCount) itemContent.insertBefore(careerMetadata, itemContent.querySelector('.portfolio-detail:not([data-label="period"]):not([data-label="location"])'));

      if (Array.isArray(entry.contactMethods) && entry.contactMethods.length) {
        const contactMethods = document.createElement('div');
        contactMethods.className = 'portfolio-contact-methods';
        entry.contactMethods.forEach(method => {
          if (typeof method.href !== 'string' ||
              (!method.href.startsWith('https://') && !method.href.startsWith('mailto:'))) return;
          const row = document.createElement('div');
          row.className = 'portfolio-contact-method';

          const info = document.createElement('div');
          info.className = 'portfolio-contact-method-info';
          const label = document.createElement('h4');
          label.textContent = method.label;
          const value = document.createElement('p');
          value.textContent = method.value;
          info.append(label, value);

          const link = document.createElement('a');
          link.className = 'inline-action';
          link.href = method.href;
          link.textContent = sentenceCaseControlLabel(method.action);
          if (method.href.startsWith('https://')) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
          }

          if (method.icon) {
            const icon = document.createElement('i');
            icon.className = `bi ${method.icon}`;
            icon.setAttribute('aria-hidden', 'true');
            link.prepend(icon);
          }
          row.append(info, link);
          contactMethods.appendChild(row);
        });
        if (contactMethods.childElementCount) itemContent.appendChild(contactMethods);
      }

      if (entry.presentation === 'evolution') appendEvolutionProgression(itemContent);
      if (entry.caseStudy) itemContent.appendChild(createCaseStudyHost(entry.caseStudy));

      if (Array.isArray(entry.projectEntries) || Array.isArray(entry.unlinkedProjects)) {
        const projectsSubsection = document.createElement('section');
        projectsSubsection.className = 'career-projects-subsection';
        const projectsHeading = document.createElement('h4');
        projectsHeading.textContent = 'Projects';
        projectsSubsection.appendChild(projectsHeading);

        const projectList = document.createElement('div');
        projectList.className = 'career-project-accordions';
        (entry.projectEntries || []).forEach(projectEntry => appendEntry(projectList, projectEntry));

        (entry.unlinkedProjects || []).forEach(name => {
          const projectName = document.createElement('p');
          projectName.className = 'career-unmapped-project';
          projectName.textContent = name;
          projectList.appendChild(projectName);
        });

        if (!projectList.childElementCount) {
          const emptyProjects = document.createElement('p');
          emptyProjects.className = 'career-projects-empty';
          emptyProjects.textContent = 'No project associations are documented for this entry.';
          projectList.appendChild(emptyProjects);
        }
        projectsSubsection.appendChild(projectList);
        itemContent.appendChild(projectsSubsection);
      }

      if (Array.isArray(entry.posts) && entry.posts.length) {
        const postsSection = document.createElement('section');
        postsSection.className = 'portfolio-contact-posts';
        const postsHeading = document.createElement('h4');
        postsHeading.textContent = 'Posts';
        postsSection.appendChild(postsHeading);

        const postsGrid = document.createElement('div');
        postsGrid.className = 'portfolio-contact-posts-grid';
        entry.posts.forEach(post => {
          const postCard = document.createElement('article');
          postCard.className = 'portfolio-contact-post';

          if (post.image?.src) {
            const imageLink = document.createElement('a');
            imageLink.className = 'portfolio-contact-post-image-link';
            imageLink.href = post.href;
            imageLink.target = '_blank';
            imageLink.rel = 'noopener noreferrer';
            imageLink.setAttribute('aria-label', sentenceCaseControlLabel(post.label));

            const image = document.createElement('img');
            image.className = 'portfolio-contact-post-image';
            image.src = post.image.src;
            image.alt = post.image.alt || '';
            image.loading = 'lazy';
            image.addEventListener('error', () => image.remove(), { once: true });
            imageLink.appendChild(image);
            postCard.appendChild(imageLink);
          }

          const description = document.createElement('p');
          description.textContent = post.description;

          const link = document.createElement('a');
          link.className = 'inline-action';
          link.href = post.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = sentenceCaseControlLabel(post.label);

          const icon = document.createElement('i');
          icon.className = 'bi bi-box-arrow-up-right';
          icon.setAttribute('aria-hidden', 'true');
          link.appendChild(icon);

          postCard.append(description, link);
          postsGrid.appendChild(postCard);
        });
        postsSection.appendChild(postsGrid);
        itemContent.appendChild(postsSection);
      }

      for (const linkData of entry.links || []) {
        if (typeof linkData.href !== 'string' ||
            (!linkData.href.startsWith('https://') && !linkData.href.startsWith('mailto:'))) continue;
        const link = document.createElement('a');
        link.className = 'inline-action';
        link.href = linkData.href;
        link.textContent = sentenceCaseControlLabel(linkData.label);
        if (linkData.icon) {
          const icon = document.createElement('i');
          icon.className = `bi ${linkData.icon}`;
          icon.setAttribute('aria-hidden', 'true');
          link.prepend(icon);
        }
        if (linkData.href.startsWith('https://')) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
        itemContent.appendChild(link);
      }

      parent.appendChild(item);
    };

    (content.entries || []).forEach(entry => appendEntry(section, entry));
  }
  portfolioContentContainer.appendChild(section);
  displayedSections.set(content.id, content);
  if (persist) persistConversationSession();
  return true;
}

function removeDisplayedPortfolioSection(content) {
  const section = findPortfolioSection(content);
  if (!section) return false;
  section.remove();
  displayedSections.delete(content.id);
  delete conversationState.removedProjects[content.id];
  persistConversationSession();
  return true;
}

function projectLabel(projectId) {
  if (projectId === 'forge') return 'Forge';
  const alias = [...PROJECT_ID_BY_NAME].find(([, id]) => id === projectId)?.[0] || projectId;
  return alias.charAt(0).toUpperCase() + alias.slice(1);
}

function findProjectIdsInText(normalizedText) {
  const ids = [];
  const padded = ` ${normalizedText} `;
  for (const [name, id] of PROJECT_ID_BY_NAME) {
    if (padded.includes(` ${name} `) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

// Career entries keep their own project accordions; only Projects, AI and detail sections are removable per project.
function findRemovableProjectItems(projectId) {
  return [...portfolioContentContainer.querySelectorAll('.portfolio-section:not(.portfolio-section--career) [data-project-id]')]
    .filter(item => item.dataset.projectId === projectId &&
      (item.classList.contains('portfolio-project-accordion') || item.classList.contains('portfolio-ai-project')));
}

function removeDisplayedProject(projectId) {
  const items = findRemovableProjectItems(projectId);
  items.forEach(item => {
    const section = item.closest('.portfolio-section');
    item.remove();
    const content = displayedSections.get(section.id);
    const hasProjects = section.querySelector('.portfolio-project-accordion, .portfolio-ai-project');
    if (!hasProjects && content) {
      removeDisplayedPortfolioSection(content);
    } else {
      const removed = conversationState.removedProjects[section.id] || [];
      if (!removed.includes(projectId)) removed.push(projectId);
      conversationState.removedProjects[section.id] = removed;
    }
  });
  persistConversationSession();
  return items.length > 0;
}

function clearDisplayedPortfolioSections() {
  const sections = portfolioContentContainer.querySelectorAll('.portfolio-section');
  const clearedCount = sections.length;
  sections.forEach(section => section.remove());
  displayedSections.clear();
  conversationState.removedProjects = {};
  persistConversationSession();

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  portfolioContentContainer.parentElement.scrollTo({
    top: 0,
    behavior: reduceMotion ? 'auto' : 'smooth'
  });
  return clearedCount;
}

function isRemoveAllRequest(normalizedQuery) {
  return /\b(clear|remove|hide|delete)\s+(all|everything|every section|all sections)\b/.test(normalizedQuery)
    || /\b(clear|remove|hide|delete)\s+all\s+(explored\s+)?(portfolio\s+)?(content|projects|sections?)\b/.test(normalizedQuery)
    || /\b(start again|start over|reset( my)? portfolio view|remove everything from (the )?portfolio view|clear (the )?(displayed|explored) sections)\b/.test(normalizedQuery);
}

function getThemeRequest(normalizedQuery) {
  const resetAppearance = /\b(reset|restore)\s+(the\s+)?(original\s+)?appearance\b/.test(normalizedQuery)
    || /\brestore the original (look|design)\b/.test(normalizedQuery);
  if (resetAppearance) return 'light';

  const darkRequest = /\b(dark mode|dark theme|dark appearance)\b/.test(normalizedQuery);
  const lightRequest = /\b(light mode|light theme|light appearance)\b/.test(normalizedQuery);
  if (darkRequest && lightRequest) {
    return normalizedQuery.lastIndexOf('dark') > normalizedQuery.lastIndexOf('light') ? 'dark' : 'light';
  }
  if (darkRequest) return 'dark';
  if (lightRequest) return 'light';
  return null;
}

function getTypographyRequest(normalizedQuery) {
  if (/\b(reset|restore)\s+(the\s+)?(original\s+)?(text|font)\s+size\b/.test(normalizedQuery)
    || /\breset\s+typography\b/.test(normalizedQuery)) return 'reset';
  if (/\b(make (everything|the text|text) easier to read|easier to read)\b/.test(normalizedQuery)) return 'easier';
  if (/\b(make (the )?(text|font|everything) (larger|bigger)|increase (the )?(font|text) size|increase text size|larger text|bigger text)\b/.test(normalizedQuery)) return 'increase';
  if (/\b(make (the )?(text|font|everything) (smaller|less large)|reduce (the )?(font|text) size|decrease (the )?(font|text) size|reduce text size|smaller text)\b/.test(normalizedQuery)) return 'decrease';
  return null;
}

function isSectionRemovalRequest(normalizedQuery) {
  return /^(remove|hide|delete)\b/.test(normalizedQuery)
    || /\b(and|then)\s+(remove|hide|delete)\b/.test(normalizedQuery)
    || /\b(don t|dont|do not) want to see\b/.test(normalizedQuery)
    || /\bno longer want to see\b/.test(normalizedQuery);
}

function persistConversationSession() {
  if (conversationState.sessionPersistenceUnavailable) return false;

  try {
    sessionStorage.setItem(CONVERSATION_SESSION_KEY, JSON.stringify({
      version: 1,
      messages: conversationState.messages,
      history: conversationState.history,
      sections: [...displayedSections.values()]
        .map(content => content.sessionDescriptor)
        .filter(Boolean),
      accordions: Object.fromEntries(
        [...portfolioContentContainer.querySelectorAll('.portfolio-project-toggle')]
          .map(toggle => [toggle.id, toggle.getAttribute('aria-expanded') === 'true'])
      ),
      removedProjects: conversationState.removedProjects,
      scroll: {
        chat: conversation.scrollTop,
        portfolio: portfolioContentContainer.parentElement.scrollTop
      }
    }));
    return true;
  } catch (error) {
    conversationState.sessionPersistenceUnavailable = true;
    console.error('Could not save the conversation for this browser tab session.', error);
    conversationStatus.textContent = 'This browser could not preserve the conversation for this tab session.';
    return false;
  }
}

async function restoreConversationSession() {
  let serialized;
  try {
    serialized = sessionStorage.getItem(CONVERSATION_SESSION_KEY);
  } catch (error) {
    conversationState.sessionPersistenceUnavailable = true;
    console.error('Could not read the conversation for this browser tab session.', error);
    conversationStatus.textContent = 'This browser could not restore the conversation for this tab session.';
    return;
  }
  if (!serialized) {
    conversationState.restoreComplete = true;
    return;
  }

  let savedState;
  try {
    savedState = JSON.parse(serialized);
  } catch (error) {
    console.error('The saved browser-tab conversation is not valid JSON.', error);
    conversationStatus.textContent = 'The saved conversation could not be restored because its session data is invalid.';
    return;
  }

  const validMessages = Array.isArray(savedState?.messages) &&
    savedState.messages.every(message =>
      message &&
      (message.role === 'user' || message.role === 'assistant') &&
      typeof message.text === 'string' &&
      (message.followUp === undefined || typeof message.followUp === 'string')
    );
  const validHistory = Array.isArray(savedState?.history) &&
    savedState.history.every(turn =>
      turn &&
      (turn.role === 'user' || turn.role === 'assistant') &&
      typeof turn.text === 'string'
    );
  const allowedTopics = new Set([
    'career', 'skills', 'design', 'contact', 'ai', 'timeOff', 'projects', 'projectDetail'
  ]);
  // Sessions saved before section persistence existed have no `sections`; rebuild them from the questions.
  const savedSections = savedState?.sections === undefined && validMessages
    ? deriveSectionsFromMessages(savedState.messages)
    : savedState?.sections;
  const validSections = Array.isArray(savedSections) &&
    savedSections.every(section =>
      section &&
      allowedTopics.has(section.topic) &&
      typeof section.query === 'string' &&
      section.query.length <= 500 &&
      (section.projectId === null ||
        (typeof section.projectId === 'string' && APPROVED_PROJECT_IDS.has(section.projectId))) &&
      (section.topic === 'projectDetail' ? typeof section.projectId === 'string' : section.projectId === null)
    );
  if (savedState?.version !== 1 || !validMessages || !validHistory || !validSections) {
    console.error('The saved browser-tab conversation has an unsupported or invalid structure.');
    conversationStatus.textContent = 'The saved conversation could not be restored because its session data is invalid.';
    return;
  }

  // Build every section before touching the DOM so both panels appear together.
  const savedRemoved = {};
  if (savedState.removedProjects && typeof savedState.removedProjects === 'object') {
    Object.entries(savedState.removedProjects).forEach(([sectionId, ids]) => {
      if (APPROVED_PORTFOLIO_SECTION_IDS.has(sectionId) && Array.isArray(ids)) {
        const valid = ids.filter(id => typeof id === 'string' && APPROVED_PROJECT_IDS.has(id));
        if (valid.length) savedRemoved[sectionId] = valid;
      }
    });
  }
  let restoredContents;
  try {
    await loadApprovedContactLinks().catch(() => {});
    restoredContents = await Promise.all(savedSections.map(async descriptor => {
      const content = await buildPortfolioDisplay(
        descriptor.topic,
        descriptor.query,
        descriptor.projectId
      );
      content.sessionDescriptor = descriptor;
      const removed = savedRemoved[content.id];
      if (removed && Array.isArray(content.entries)) {
        content.entries = content.entries.filter(entry => !removed.includes(entry.projectId));
      }
      return content;
    }));
    conversationState.removedProjects = savedRemoved;
  } catch (error) {
    console.error('Could not rebuild the saved portfolio sections.', error);
    restoredContents = [];
    conversationStatus.textContent = 'The previous portfolio content could not be restored.';
  }

  conversationState.messages = savedState.messages;
  conversationState.history = savedState.history.slice(-MAX_CONVERSATION_HISTORY);
  conversationState.messages.forEach(message =>
    addChatMessage(message.text, message.role, message.followUp, false)
  );
  restoredContents.forEach(content => renderPortfolioSection(content, false));

  const savedAccordions = savedState.accordions;
  if (savedAccordions && typeof savedAccordions === 'object') {
    portfolioContentContainer.querySelectorAll('.portfolio-project-toggle').forEach(toggle => {
      if (typeof savedAccordions[toggle.id] === 'boolean') {
        setProjectAccordionExpanded(toggle, savedAccordions[toggle.id], false);
      }
    });
  }

  const lastMessage = conversationState.messages.at(-1);
  if (lastMessage?.role === 'user') {
    addChatMessage(
      'This question was interrupted while you were away. Please send it again.',
      'assistant',
      undefined,
      false
    );
  }
  persistConversationSession();
  conversationState.restoreComplete = true;

  const savedScroll = savedState.scroll;
  if (Number.isFinite(savedScroll?.chat)) conversation.scrollTop = savedScroll.chat;
  if (Number.isFinite(savedScroll?.portfolio)) {
    portfolioContentContainer.parentElement.scrollTop = savedScroll.portfolio;
  }
}

function deriveSectionsFromMessages(messages) {
  const sections = [];
  const history = [];
  messages.forEach(message => {
    if (message.role === 'assistant') {
      history.push({ role: 'assistant', text: message.text });
      return;
    }
    try {
      const normalized = normalizeQuery(message.text);
      if (isRemoveAllRequest(normalized)) {
        sections.length = 0;
      } else if (!isSectionRemovalRequest(normalized)) {
        const resolved = resolveDisplayTopic(message.text, history);
        const projectId = resolved.projectId;
        const topic = resolved.topic;
        const query = getTopicSourceQuery(message.text, history);
        const descriptor = { topic, query, projectId: topic === 'projectDetail' ? projectId : null };
        if (topic && !sections.some(item => item.topic === topic && item.projectId === descriptor.projectId)) {
          sections.push(descriptor);
        }
      }
    } catch (error) {
      console.error('Could not derive a portfolio section from a saved question.', error);
    }
    history.push({ role: 'user', text: message.text });
  });
  return sections;
}

function addChatMessage(text, role, followUp, persist = true) {
  const wrapper = document.createElement('div');
  wrapper.className = `chat-message ${role}`;

  const speaker = role === 'assistant'
    ? createAssistantSpeaker()
    : document.createElement('div');
  speaker.className = role === 'assistant' ? 'speaker assistant-speaker' : 'speaker';
  if (role === 'user') speaker.textContent = 'YOU';
  wrapper.appendChild(speaker);
  if (role === 'assistant') {
    appendFormattedAssistantText(wrapper, text);
  } else {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    wrapper.appendChild(paragraph);
  }

  if (followUp) {
    const followUpMessage = document.createElement('p');
    followUpMessage.className = 'follow-up';
    appendLinkedText(followUpMessage, followUp);
    wrapper.appendChild(followUpMessage);
  }

  if (role === 'assistant') {
    const accessibleText = text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\s+\*\s+/g, '; ')
      .replace(/(?:^|\n)\s*[-*]\s+/g, '; ');
    conversationStatus.textContent = followUp
      ? `${accessibleText} ${followUp}`
      : accessibleText;
  }

  conversation.appendChild(wrapper);
  if (persist) {
    conversationState.messages.push({
      text,
      role,
      ...(followUp ? { followUp } : {})
    });
    persistConversationSession();
  }
  scrollToLatestMessage();
}

window.addEventListener('pagehide', () => {
  if (conversationState.restoreComplete) persistConversationSession();
});

restoreConversationSession().catch(error => {
  console.error('Could not restore the browser-tab portfolio session.', error);
  conversationStatus.textContent = 'The previous portfolio content could not be restored.';
});

function showTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'chat-message assistant typing';
  indicator.id = 'typing-indicator';

  const speaker = createAssistantSpeaker();

  const dots = document.createElement('span');
  dots.className = 'typing-dots';
  dots.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 3; index += 1) {
    dots.appendChild(document.createElement('span'));
  }

  indicator.append(speaker, dots);
  conversationStatus.textContent = 'Portfolio Assist is typing.';
  conversation.appendChild(indicator);
  scrollToLatestMessage();
}

function hideTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}

function setResponding(isResponding) {
  conversationState.isResponding = isResponding;
  conversation.setAttribute('aria-busy', String(isResponding));
  input.disabled = isResponding;
  sendButton.disabled = isResponding;
  suggestions.querySelectorAll('button').forEach(button => {
    button.disabled = isResponding;
  });
}

function getPortfolioUiActions(query) {
  const normalized = normalizeQuery(query);
  const requestedTheme = getThemeRequest(normalized);
  const requestedTypography = getTypographyRequest(normalized);
  const actions = {
    ...(requestedTheme ? { themeChange: requestedTheme } : {}),
    ...(requestedTypography ? { typographyChange: requestedTypography } : {})
  };

  if (isRemoveAllRequest(normalized)) {
    return {
      ...actions,
      clearPortfolio: true,
      hadDisplayedSections: portfolioContentContainer.querySelectorAll('.portfolio-section').length > 0
    };
  }

  if (isSectionRemovalRequest(normalized)) {
    // Only the part before "but keep ..." names what to remove.
    const target = normalized.split(/\b(?:but|except|while|and keep|keeping|keep)\b/)[0];
    const displayed = [...displayedSections.values()].find(content =>
      ` ${target} `.includes(` ${normalizeQuery(content.title)} `)
    );
    const projectIds = findProjectIdsInText(target);
    if (displayed || projectIds.length) {
      return {
        ...actions,
        ...(displayed ? { removeContent: displayed } : {}),
        ...(projectIds.length ? { removeProjects: projectIds } : {})
      };
    }
  }

  const resolved = resolveDisplayTopic(query, conversationState.history);
  return {
    ...actions,
    displayTopic: resolved.topic,
    displayQuery: getTopicSourceQuery(query, conversationState.history)
  };
}

async function requestAssistantResponse(message) {
  if (!PORTFOLIO_ASSIST_API_ENDPOINT) {
    const error = new Error('Open Portfolio Assist through a local web server to chat.');
    error.code = 'FILE_PROTOCOL';
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
  const encoder = new TextEncoder();
  const history = [];
  let historyBytes = 0;
  for (const turn of conversationState.history.slice(-MAX_CONVERSATION_HISTORY).reverse()) {
    if ((turn.role !== 'user' && turn.role !== 'assistant') || typeof turn.text !== 'string') continue;
    const characters = Array.from(turn.text.trim()).slice(0, MAX_HISTORY_MESSAGE_LENGTH);
    const availableBytes = MAX_HISTORY_BYTES - historyBytes - 32;
    if (!characters.length || availableBytes <= 0) break;

    let low = 0;
    let high = characters.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (encoder.encode(characters.slice(0, middle).join('')).length <= availableBytes) low = middle;
      else high = middle - 1;
    }

    const text = characters.slice(0, low).join('');
    if (!text) break;
    history.push({ role: turn.role, text });
    historyBytes += encoder.encode(text).length + 32;
  }
  history.reverse();
  let response;

  try {
    response = await fetch(PORTFOLIO_ASSIST_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        ...(history.length ? { history } : {})
      }),
      signal: controller.signal
    });

    let result;
    try {
      result = await response.json();
    } catch {
      const error = new Error('The assistant returned an invalid response.');
      error.code = 'INVALID_RESPONSE';
      throw error;
    }

    if (!response.ok) {
      const error = new Error('The assistant API could not complete the request.');
      error.code = typeof result?.error?.code === 'string'
        ? result.error.code
        : 'HTTP_ERROR';
      error.status = response.status;
      throw error;
    }

    if (
      result?.success !== true ||
      typeof result.reply !== 'string' ||
      !result.reply.trim()
    ) {
      const error = new Error('The assistant returned an invalid response.');
      error.code = 'INVALID_RESPONSE';
      throw error;
    }

    return result.reply.trim();
  } catch (error) {
    if (error?.code) throw error;
    if (controller.signal.aborted) {
      const timeoutError = new Error('The assistant request timed out.');
      timeoutError.code = 'API_TIMEOUT';
      throw timeoutError;
    }
    const networkError = new Error('The assistant API could not be reached.');
    networkError.code = IS_LOCAL_DEVELOPMENT ? 'LOCAL_API_UNAVAILABLE' : 'NETWORK_ERROR';
    throw networkError;
  } finally {
    clearTimeout(timeout);
  }
}

function getPortfolioSectionId(topic, projectId) {
  return topic === 'projectDetail'
    ? `portfolio-project-detail-${projectId}`
    : `portfolio-topic-${topic}`;
}

function scrollPortfolioSectionIntoView(section) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior = reduceMotion ? 'auto' : 'smooth';
  const portfolioPanel = portfolioContentContainer.parentElement;
  const top = section.getBoundingClientRect().top -
    portfolioPanel.getBoundingClientRect().top +
    portfolioPanel.scrollTop;
  portfolioPanel.scrollTo({ top, behavior });
}

function setProjectAccordionExpanded(toggle, expanded, persist = true) {
  const panelId = toggle.getAttribute('aria-controls');
  const panel = panelId ? document.getElementById(panelId) : null;
  if (!panel) return false;
  toggle.setAttribute('aria-expanded', String(expanded));
  const indicator = toggle.querySelector('.portfolio-project-indicator');
  if (indicator) indicator.textContent = expanded ? '−' : '+';
  panel.hidden = !expanded;
  if (persist) persistConversationSession();
  return true;
}

function findDisplayedProjectAccordion(projectId) {
  return [...portfolioContentContainer.querySelectorAll('.portfolio-project-toggle')]
    .find(toggle => toggle.dataset.projectId === projectId) || null;
}

function focusProjectAccordion(toggle) {
  setProjectAccordionExpanded(toggle, true);
  scrollPortfolioSectionIntoView(toggle);
}

function showPortfolioSkeleton(topic) {
  const skeleton = document.createElement('div');
  skeleton.className = `portfolio-skeleton portfolio-skeleton--${topic}`;
  skeleton.dataset.portfolioSkeleton = topic;
  skeleton.setAttribute('aria-hidden', 'true');
  portfolioContentContainer.setAttribute('aria-busy', 'true');

  const cardCount = topic === 'career' ? 3 : topic === 'skills' ? 4 : topic === 'projects' ? 2 : 1;
  for (let index = 0; index < cardCount; index += 1) {
    const card = document.createElement('div');
    card.className = 'portfolio-skeleton-card';
    const title = document.createElement('span');
    title.className = 'portfolio-skeleton-line portfolio-skeleton-title';
    const summary = document.createElement('span');
    summary.className = 'portfolio-skeleton-line';
    const detail = document.createElement('span');
    detail.className = 'portfolio-skeleton-line portfolio-skeleton-short';
    card.append(title, summary, detail);

    if (topic === 'skills') {
      const badges = document.createElement('span');
      badges.className = 'portfolio-skeleton-badges';
      for (let badgeIndex = 0; badgeIndex < 5; badgeIndex += 1) {
        const badge = document.createElement('span');
        badge.className = 'portfolio-skeleton-badge';
        badges.appendChild(badge);
      }
      card.appendChild(badges);
    } else if (topic === 'projectDetail' || topic === 'ai' || topic === 'projects') {
      const image = document.createElement('span');
      image.className = 'portfolio-skeleton-image';
      card.appendChild(image);
    }

    skeleton.appendChild(card);
  }

  portfolioContentContainer.appendChild(skeleton);
  scrollPortfolioSectionIntoView(skeleton);
  return skeleton;
}

function removePortfolioSkeleton(skeleton) {
  if (skeleton?.isConnected) skeleton.remove();
  if (!portfolioContentContainer.querySelector('.portfolio-skeleton')) {
    portfolioContentContainer.removeAttribute('aria-busy');
  }
}

function hasDisplayedPortfolioContent(topic, query) {
  const projectId = topic === 'projectDetail' ? identifyProjectId(query) : null;
  if (projectId) return Boolean(findDisplayedProjectAccordion(projectId));
  if (topic === 'timeOff') return Boolean(findDisplayedProjectAccordion('time-off-policy-setup'));
  if (topic === 'ai') {
    return ['smart-implementation', 'evolution'].every(id => findDisplayedProjectAccordion(id));
  }
  return Boolean(document.getElementById(getPortfolioSectionId(topic, projectId)));
}

async function renderPortfolioTopic(topic, query, pendingSkeleton = null) {
  if (!topic) return false;
  const projectId = topic === 'projectDetail' ? identifyProjectId(query) : null;
  if (topic === 'projectDetail' && (!projectId || !APPROVED_PROJECT_IDS.has(projectId))) {
    throw new Error('The requested project is not approved.');
  }
  const sectionId = getPortfolioSectionId(topic, projectId);
  const projectDetailIsApproved = sectionId.startsWith('portfolio-project-detail-') &&
    APPROVED_PROJECT_IDS.has(sectionId.slice('portfolio-project-detail-'.length));
  if (!APPROVED_PORTFOLIO_SECTION_IDS.has(sectionId) && !projectDetailIsApproved) {
    throw new Error('The requested portfolio section is not approved.');
  }

  const removedHere = conversationState.removedProjects[sectionId];
  const sectionToRebuild = removedHere?.length ? displayedSections.get(sectionId) : null;
  // Asking for a section again restores projects that were removed from it.
  if (sectionToRebuild) removeDisplayedPortfolioSection(sectionToRebuild);

  const displayedProjectAccordion = projectId
    ? findDisplayedProjectAccordion(projectId)
    : topic === 'timeOff'
      ? findDisplayedProjectAccordion('time-off-policy-setup')
      : null;
  if (displayedProjectAccordion) {
    focusProjectAccordion(displayedProjectAccordion);
    removePortfolioSkeleton(pendingSkeleton);
    return false;
  }

  if (topic === 'ai') {
    const aiProjectIds = ['smart-implementation', 'evolution'];
    const existingAiToggles = aiProjectIds
      .map(findDisplayedProjectAccordion)
      .filter(Boolean);
    existingAiToggles.forEach(toggle => setProjectAccordionExpanded(toggle, true));
    if (existingAiToggles.length === aiProjectIds.length) {
      scrollPortfolioSectionIntoView(existingAiToggles[0]);
      removePortfolioSkeleton(pendingSkeleton);
      return false;
    }
  }

  const existingSection = document.getElementById(sectionId);
  if (existingSection) {
    const existingToggles = topic === 'ai'
      ? [...existingSection.querySelectorAll('.portfolio-project-toggle')]
      : [existingSection.querySelector('.portfolio-project-toggle')].filter(Boolean);
    existingToggles.forEach(toggle => setProjectAccordionExpanded(toggle, true));
    const existingToggle = existingToggles[0];
    if (existingToggle) {
      focusProjectAccordion(existingToggle);
    } else {
      scrollPortfolioSectionIntoView(existingSection);
    }
    removePortfolioSkeleton(pendingSkeleton);
    return false;
  }

  const knowledgeName = topic === 'career' ? 'career'
    : topic === 'skills' ? 'skills'
      : topic === 'design' ? 'design-philosophy'
        : topic === 'contact' ? 'contact'
          : ['projects', 'ai', 'projectDetail'].includes(topic) ? 'projects'
            : null;
  const shouldShowSkeleton = topic === 'timeOff' ||
    (knowledgeName !== null && !knowledgeCache.has(knowledgeName));
  const skeleton = pendingSkeleton || (shouldShowSkeleton ? showPortfolioSkeleton(topic) : null);

  try {
    const content = await buildPortfolioDisplay(topic, query, projectId);
    content.sessionDescriptor = { topic, query, projectId };
    removePortfolioSkeleton(skeleton);
    renderPortfolioSection(content);
    const section = document.getElementById(content.id);
    const accordion = section?.querySelector('.portfolio-project-toggle');
    if (accordion) scrollPortfolioSectionIntoView(accordion);
    else if (section) scrollPortfolioSectionIntoView(section);
    return true;
  } finally {
    removePortfolioSkeleton(skeleton);
  }
}

function getAssistantFailureMessage(error) {
  const messages = {
    FILE_PROTOCOL: 'To chat locally, start the site and Worker using the local development commands. Opening the HTML file directly does not allow browser API access.',
    LOCAL_API_UNAVAILABLE: 'The local Portfolio Assist Worker is not running. Start it from the worker folder, then try again.',
    API_TIMEOUT: 'Portfolio Assist is taking longer than expected. Please try again.',
    AI_SERVICE_TIMEOUT: 'Portfolio Assist is taking longer than expected. Please try again.',
    AI_SERVICE_UNAVAILABLE: 'Portfolio Assist is temporarily unavailable. Please try again later.',
    AI_SERVICE_NOT_CONFIGURED: 'Portfolio Assist is temporarily unavailable. Please try again later.',
    AI_AUTHENTICATION_FAILED: 'Portfolio Assist is temporarily unavailable. Please try again later.',
    AI_PROVIDER_ERROR: 'The AI service could not complete that reply. Please try again shortly.',
    AI_RATE_LIMITED: 'Portfolio Assist is busy right now. Please try again shortly.',
    AI_UPSTREAM_ERROR: 'I could not complete that response. Please try again.',
    AI_INVALID_RESPONSE: 'I could not prepare a response just now. Please try again.',
    NETWORK_ERROR: 'Portfolio Assist could not be reached. Please try again.',
    INVALID_RESPONSE: 'I could not prepare a response just now. Please try again.',
    INVALID_HISTORY: 'I could not continue that conversation. Please try asking your question again.',
    UNSUPPORTED_FIELDS: 'I could not process that question. Please try again.',
    REQUEST_TOO_LARGE: 'That request is too long. Please shorten it and try again.',
    MESSAGE_TOO_LONG: 'That question is too long. Please shorten it and try again.',
    RATE_LIMITED: 'Too many requests in a short time. Please wait a few minutes and try again.',
    INTERNAL_SERVER_ERROR: 'Portfolio Assist ran into an unexpected problem. Please try again.',
    HTTP_ERROR: 'Portfolio Assist is temporarily unavailable. Please try again later.'
  };
  if (Object.prototype.hasOwnProperty.call(messages, error?.code)) return messages[error.code];
  const category = typeof error?.code === 'string' ? ` (error: ${error.code})` : '';
  return `Portfolio Assist could not complete that reply. Please try again.${category}`;
}

// Shows the existing Contact section (or scrolls to it) and returns a follow-up line for the chat.
async function showContactForLocationReply() {
  try {
    await renderPortfolioTopic('contact', 'contact');
  } catch (error) {
    console.error('Portfolio knowledge display failed:', error);
    return 'I could not load the contact details just now.';
  }
  return approvedContactLinks.length
    ? `You can reach out at ${approvedContactLinks.map(link => link.text).join(' or ')}.`
    : 'My contact details are displayed in the portfolio panel.';
}

async function submitQuestion(question) {
  if (conversationState.isResponding) return;

  const value = question.trim().slice(0, 500);
  if (!value) return;

  let restoreInputFocus = false;
  let portfolioDisplayError = '';
  let portfolioDisplayConfirmation = '';
  let pendingPortfolioSkeleton = null;
  setResponding(true);
  let uiActionConfirmation = '';
  let uiActionConfirmations = '';
  try {
    addChatMessage(value, 'user');
    showTypingIndicator();
    await loadApprovedContactLinks().catch(() => {});
    const uiActions = getPortfolioUiActions(value);

    if (uiActions.themeChange) applyTheme(uiActions.themeChange);
    const themeConfirmation = uiActions.themeChange
      ? `Switched to the ${uiActions.themeChange} theme.`
      : '';
    const typographyConfirmation = uiActions.typographyChange
      ? applyTypographyRequest(uiActions.typographyChange)
      : '';
    uiActionConfirmations = [
      themeConfirmation,
      typographyConfirmation
    ].filter(Boolean).join(' ');

    if (isLocationQuestion(value)) {
      // Fixed, owner-approved answer; no model request is needed.
      conversationState.history.push(
        { role: 'user', text: value },
        { role: 'assistant', text: LOCATION_REPLY }
      );
      conversationState.history = conversationState.history.slice(-MAX_CONVERSATION_HISTORY);
      addChatMessage(LOCATION_REPLY, 'assistant', await showContactForLocationReply());
      return;
    }

    if (uiActions.removeContent || uiActions.removeProjects) {
      restoreInputFocus = true;
      const removedTitles = [];
      const missingTitles = [];
      if (uiActions.removeContent) {
        const title = uiActions.removeContent.title;
        (removeDisplayedPortfolioSection(uiActions.removeContent) ? removedTitles : missingTitles).push(title);
      }
      (uiActions.removeProjects || []).forEach(projectId => {
        const title = projectLabel(projectId);
        if (removedTitles.includes(title)) return;
        (removeDisplayedProject(projectId) ? removedTitles : missingTitles).push(title);
      });
      uiActionConfirmation = [
        removedTitles.length
          ? `${removedTitles.join(' and ')} ${removedTitles.length > 1 ? 'have' : 'has'} been removed from the portfolio view. Your other displayed sections are unchanged.`
          : '',
        missingTitles.length
          ? `${missingTitles.join(' and ')} ${missingTitles.length > 1 ? 'are' : 'is'} not currently displayed in the portfolio view.`
          : ''
      ].filter(Boolean).join(' ');

      if (uiActions.removeProjects?.length) {
        // The frontend performs this action itself, so no model reply is needed.
        conversationState.history.push(
          { role: 'user', text: value },
          { role: 'assistant', text: uiActionConfirmation }
        );
        conversationState.history = conversationState.history.slice(-MAX_CONVERSATION_HISTORY);
        addChatMessage([uiActionConfirmation, uiActionConfirmations].filter(Boolean).join(' '), 'assistant');
        return;
      }
    }

    if (uiActions.clearPortfolio) {
      restoreInputFocus = true;
      if (uiActions.hadDisplayedSections) {
        clearDisplayedPortfolioSections();
        uiActionConfirmation = 'All explored portfolio content has been cleared. Your conversation is unchanged.';
      } else {
        uiActionConfirmation = 'There are no explored portfolio sections to clear. Your introduction is still here.';
      }
    }

    if (uiActions.displayTopic &&
        !hasDisplayedPortfolioContent(uiActions.displayTopic, uiActions.displayQuery)) {
      pendingPortfolioSkeleton = showPortfolioSkeleton(uiActions.displayTopic);
    }

    let response;
    let requestError;
    try {
      response = await requestAssistantResponse(value);
    } catch (error) {
      requestError = error;
    }

    if (uiActions.displayTopic) {
      try {
        const added = await renderPortfolioTopic(
          uiActions.displayTopic,
          uiActions.displayQuery,
          pendingPortfolioSkeleton
        );
        pendingPortfolioSkeleton = null;
        if (uiActions.displayTopic === 'career') {
          portfolioDisplayConfirmation = 'The complete Career Timeline is displayed in the portfolio panel.';
        } else if (uiActions.displayTopic === 'contact' && approvedContactLinks.length) {
          portfolioDisplayConfirmation = `You can reach out at ${approvedContactLinks.map(link => link.text).join(' or ')}.`;
        } else if (!added) {
          portfolioDisplayConfirmation = 'That section is already displayed; I’ve scrolled to it.';
        } else if (uiActions.displayTopic === 'projectDetail') {
          portfolioDisplayConfirmation = 'Project details are displayed in the portfolio panel.';
        }
      } catch (error) {
        removePortfolioSkeleton(pendingPortfolioSkeleton);
        pendingPortfolioSkeleton = null;
        portfolioDisplayError = 'I could not load that portfolio section. Please confirm the site is being served from the project root and try again.';
        console.error('Portfolio knowledge display failed:', error);
      }
    }

    if (requestError) throw requestError;
    const followUp = [portfolioDisplayError, portfolioDisplayConfirmation, uiActionConfirmation, uiActionConfirmations].filter(Boolean).join(' ');
    conversationState.history.push(
      { role: 'user', text: value },
      { role: 'assistant', text: response }
    );
    conversationState.history = conversationState.history.slice(-MAX_CONVERSATION_HISTORY);
    addChatMessage(
      response,
      'assistant',
      followUp
    );
  } catch (error) {
    console.warn(
      'Portfolio Assist request failed:',
      typeof error?.code === 'string' ? error.code : 'CLIENT_ERROR'
    );
    addChatMessage(
      getAssistantFailureMessage(error),
      'assistant',
      [portfolioDisplayError, portfolioDisplayConfirmation, uiActionConfirmation, uiActionConfirmations].filter(Boolean).join(' ')
    );
  } finally {
    removePortfolioSkeleton(pendingPortfolioSkeleton);
    hideTypingIndicator();
    setResponding(false);
    if (restoreInputFocus) input.focus();
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (conversationState.isResponding) return;

  const value = input.value.trim();
  if (!value) {
    input.setCustomValidity('Please enter a question before sending.');
    input.reportValidity();
    return;
  }

  input.setCustomValidity('');
  submitQuestion(value);
  if (conversationState.isResponding) input.value = '';
});

input.addEventListener('input', () => input.setCustomValidity(''));

suggestions.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button && !conversationState.isResponding) submitQuestion(button.textContent);
});

portfolioContentContainer.addEventListener('click', event => {
  const projectToggle = event.target.closest('.portfolio-project-toggle');
  if (projectToggle) {
    const expanded = projectToggle.getAttribute('aria-expanded') === 'true';
    if (setProjectAccordionExpanded(projectToggle, !expanded) &&
        !expanded &&
        projectToggle.closest('.career-project-accordion')) {
      scrollPortfolioSectionIntoView(projectToggle);
    }
    return;
  }

  const button = event.target.closest('.portfolio-section-remove');
  if (!button) return;

  const section = button.closest('.portfolio-section');
  if (!section) return;
  const content = displayedSections.get(section.id);
  const sections = [...portfolioContentContainer.querySelectorAll('.portfolio-section')];
  const sectionIndex = sections.indexOf(section);
  if (!section || !content || !removeDisplayedPortfolioSection(content)) return;

  const restoreKeyboardFocus = event.detail === 0;
  const nextSection = sections[sectionIndex + 1];
  const previousSection = sections[sectionIndex - 1];

  addChatMessage(`${content.title} has been removed from the portfolio view.`, 'assistant');
  if (restoreKeyboardFocus) {
    const focusTarget = nextSection || previousSection;
    const removeButton = focusTarget && focusTarget.querySelector('.portfolio-section-remove');
    (removeButton || input).focus();
  }
});
