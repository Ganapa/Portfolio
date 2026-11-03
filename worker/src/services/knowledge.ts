import assistantGuidelines from "../../../knowledge/assistant-guidelines.json";
import career from "../../../knowledge/career.json";
import contact from "../../../knowledge/contact.json";
import designPhilosophy from "../../../knowledge/design-philosophy.json";
import profile from "../../../knowledge/profile.json";
import projects from "../../../knowledge/projects.json";
import skills from "../../../knowledge/skills.json";
import toolsAndTechnologies from "../../../knowledge/tools-and-technologies.json";
import type {
  ConversationTurn,
  PortfolioKnowledgeContext,
  PortfolioProjectSummary,
} from "../types";

type KnowledgeChunk = {
  label: string;
  content: unknown;
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesPhrase(normalizedQuery: string, value: string): boolean {
  const phrase = normalize(value);
  return phrase.length > 0 && ` ${normalizedQuery} `.includes(` ${phrase} `);
}

function withoutSourceMetadata<T extends Record<string, unknown>>(value: T): Omit<T, "source" | "schemaVersion"> {
  const { source: _source, schemaVersion: _schemaVersion, ...content } = value;
  return content;
}

function projectById(projectId: string) {
  return projects.projects.find((project) => project.id === projectId);
}

const PROJECT_NAVIGATION = new Map<string, string>([
  ["time-off-policy-setup", "time-off-policy-setup"],
  ["forge", "forge"],
  ["medivera", "medivera"],
  ["evolution", "evolution"],
  ["smart-implementation", "smart-implementation"],
  ["total-rewards", "total-rewards"],
  ["secutime", "secutime"],
  ["ach-store", "ach-store"],
  ["helios-insurance", "helios-insurance"],
  ["singapore-cpfb", "singapore-cpfb"],
  ["bdo", "bdo"],
  ["world-bank", "world-bank"],
  ["maersk", "maersk"],
  ["crown-nest", "crown-nest"],
  ["novartis", "novartis"],
  ["web-design-portfolio", "web-design-portfolio"],
]);

function isProjectDiscoveryRequest(query: string): boolean {
  return /\b(show|display|view|explore|see|open|find|list|which|what|tell me about|more about|have you worked on)\b/.test(
    query,
  );
}

function matchingProjects(query: string) {
  const projectDiscovery =
    /\b(project|projects|case stud(y|ies)|portfolio|work|experience|enterprise|accessibility|design system|research|ai|artificial intelligence)\b/.test(
      query,
    ) ||
    projects.projects.some((project) => matchesPhrase(query, project.name));
  const selectedIds = new Set<string>();

  if (!projectDiscovery) return selectedIds;

  const matchingIntents = assistantGuidelines.intentMappings.filter((mapping) =>
    mapping.keywords.some((keyword) => matchesPhrase(query, keyword)),
  );
  for (const mapping of matchingIntents) {
    mapping.projectIds.forEach((projectId) => selectedIds.add(projectId));
  }

  const matchedSkills = skills.categories
    .flatMap((category) => category.skills)
    .filter((skill) => matchesPhrase(query, skill));
  const matchedSkillIds = new Set(
    matchedSkills.map((skill) => normalize(skill).replaceAll(" ", "-")),
  );

  for (const project of projects.projects) {
    const searchText = normalize(
      [
        project.name,
        project.classification ?? "",
        project.summary,
        project.productArea ?? "",
        project.overview ?? "",
        project.story ?? "",
        ...(project.details ?? []),
        ...(project.responsibilities ?? []),
        ...(project.relatedSkillIds ?? []),
      ].join(" "),
    );

    if (matchesPhrase(query, project.name)) {
      selectedIds.add(project.id);
    } else if (
      query.includes("complete case study") ||
      query.includes("case studies") ||
      query.includes("case study")
    ) {
      if (project.classification === "Complete case study") {
        selectedIds.add(project.id);
      }
    } else if (
      query.includes("accessibility") &&
      /\b(accessibility|accessible|inclusive|wcag)\b/.test(searchText)
    ) {
      selectedIds.add(project.id);
    } else if (
      query.includes("research") &&
      (/\b(research|interviews|personas|usability testing)\b/.test(searchText) ||
        project.relatedSkillIds?.some((skillId) =>
          matchedSkillIds.has(skillId),
        ))
    ) {
      selectedIds.add(project.id);
    } else if (project.relatedSkillIds?.some((skillId) => matchedSkillIds.has(skillId))) {
      selectedIds.add(project.id);
    } else if (
      matchingIntents.length === 0 &&
      projectDiscovery &&
      /^(what|which|show|list|tell me about|have you worked on)\b/.test(query) &&
      /\b(projects|portfolio|work)\b/.test(query)
    ) {
      selectedIds.add(project.id);
    }

    if (project.classification === "Complete case study" && query.includes("case study")) {
      selectedIds.add(project.id);
    }
  }

  return selectedIds;
}

function navigationTarget(query: string): string | null {
  if (!/\b(open|visit|navigate|go to|link|prototype|resource)\b/.test(query)) {
    return null;
  }

  const project = projects.projects.find((item) =>
    matchesPhrase(query, item.name),
  );
  return project && PROJECT_NAVIGATION.get(project.id)
    ? project.id
    : null;
}

export function buildKnowledgeContext(
  message: string,
  history: ConversationTurn[] = [],
): PortfolioKnowledgeContext {
  const isContextualFollowUp =
    /^(tell me more|more about (it|that|them)|what about (it|that|them)|and (what|how|why)|why|how so|can you explain more|expand on that)\b/.test(
      normalize(message),
    );
  const lastUserMessage = [...history]
    .reverse()
    .find((turn) => turn.role === "user")?.text;
  const normalizedQuery = normalize(
    isContextualFollowUp && lastUserMessage
      ? `${lastUserMessage} ${message}`
      : message,
  );
  const chunks: KnowledgeChunk[] = [
    {
      label: "Profile",
      content: withoutSourceMetadata(profile),
    },
  ];

  const addChunk = (label: string, content: unknown) => {
    if (!chunks.some((chunk) => chunk.label === label)) {
      chunks.push({ label, content });
    }
  };

  const responseRules = assistantGuidelines.responseRules;
  const matchingIntents = assistantGuidelines.intentMappings.filter((mapping) =>
    mapping.keywords.some((keyword) => matchesPhrase(normalizedQuery, keyword)),
  );
  const selectedProjectIds = matchingProjects(normalizedQuery);
  const mappedProjectIds = new Set(
    matchingIntents.flatMap((mapping) => mapping.projectIds),
  );
  selectedProjectIds.forEach((projectId) => mappedProjectIds.add(projectId));
  const broadProjectDiscovery = matchingIntents.some(
    (mapping) => mapping.intent === "broad_project_discovery",
  );

  const careerRequested =
    /\b(career|career timeline|employment|professional background|professional experience|work experience|work history|career history|your experience|my experience|experience summary|roles?|companies|employer|job history|where did you work|worked at|work at)\b/.test(
      normalizedQuery,
    ) ||
    career.experience.some((entry) =>
      matchesPhrase(normalizedQuery, entry.company),
    );

  if (careerRequested) {
    addChunk("Career", {
      presentation: career.presentation,
      experience: career.experience,
    });
  }

  if (broadProjectDiscovery && selectedProjectIds.size === projects.projects.length) {
    addChunk(
      "Project directory",
      projects.projects.map(({ id, name, classification, summary }) => ({
        id,
        name,
        classification,
        summary,
      })),
    );
  } else {
    for (const projectId of mappedProjectIds) {
      const project = projectById(projectId);
      if (project) {
        addChunk(`Project: ${project.name}`, withoutSourceMetadata(project));
      }
    }
  }

  const knownSkills = skills.categories.flatMap((category) => category.skills);
  const skillRequested =
    /\b(skill|skills|strengths|capabilities|expertise|research|prototyping|accessibility|leadership)\b/.test(
      normalizedQuery,
    ) || knownSkills.some((skill) => matchesPhrase(normalizedQuery, skill));

  if (skillRequested) {
    addChunk("Skills", { categories: skills.categories });
  }

  if (
    /\b(design|philosophy|approach|principles|mesh|human|systems?)\b/.test(
      normalizedQuery,
    ) ||
    designPhilosophy.principles.some((principle) =>
      matchesPhrase(normalizedQuery, principle.name),
    ) ||
    designPhilosophy.meshPrinciples.principles.some((principle) =>
      matchesPhrase(normalizedQuery, principle),
    )
  ) {
    addChunk(
      "Design philosophy",
      withoutSourceMetadata(designPhilosophy),
    );
  }

  const allToolDetails = [
    ...toolsAndTechnologies.experienceDetails,
    ...toolsAndTechnologies.additionalTechnologyExperienceDetails,
  ];
  const knownTools = [
    ...toolsAndTechnologies.toolsAndCapabilities,
    ...allToolDetails.map((tool) => tool.name),
  ];
  const toolsRequested =
    /\b(tool|tools|technology|technologies|software)\b/.test(
      normalizedQuery,
    ) || knownTools.some((tool) => matchesPhrase(normalizedQuery, tool));

  if (toolsRequested) {
    const matchingTools = allToolDetails.filter((tool) =>
      matchesPhrase(normalizedQuery, tool.name),
    );
    const allTools = /\b(tools|technologies|software)\b/.test(normalizedQuery);
    addChunk("Tools and technologies", {
      toolsAndCapabilities: allTools
        ? toolsAndTechnologies.toolsAndCapabilities
        : matchingTools.map((tool) => tool.name),
      experienceDetails: allTools
        ? allToolDetails
        : matchingTools,
      additionalTechnologiesNamedInExperience:
        allTools
          ? toolsAndTechnologies.additionalTechnologiesNamedInExperience
          : matchingTools
              .filter((tool) =>
                toolsAndTechnologies.additionalTechnologyExperienceDetails.some(
                  (additionalTool) => additionalTool.name === tool.name,
                ),
              )
              .map((tool) => tool.name),
    });
  }

  if (
    /\b(contact|email|linkedin|reach|connect|phone|education|degree|certification|certifications|resume|résumé|cv|document|download)\b/.test(
      normalizedQuery,
    )
  ) {
    addChunk("Contact and disclosed portfolio limitations", {
      email: contact.email,
      professionalProfile: contact.professionalProfile,
      resources: contact.resources,
      education: contact.education,
      certifications: contact.certifications,
      documents: contact.documents,
      limitationsToDisclose: assistantGuidelines.limitationsToDisclose,
    });
  }

  const output = {
    responseRules,
    relevantKnowledge: chunks,
  };

  const displayProjects: PortfolioProjectSummary[] =
    isProjectDiscoveryRequest(normalizedQuery)
      ? [...selectedProjectIds]
          .map(projectById)
          .filter((project): project is NonNullable<typeof project> => Boolean(project))
          .map((project) => ({
            id: project.id,
            name: project.name,
            classification: project.classification,
            summary: project.summary,
          }))
      : [];

  return {
    context: JSON.stringify(output),
    displayProjects,
    navigationProjectId: navigationTarget(normalizedQuery),
  };
}
