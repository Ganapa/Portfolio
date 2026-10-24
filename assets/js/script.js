
document.addEventListener("DOMContentLoaded", function () {
  const filters = document.querySelectorAll(".work-filter");
  const projects = document.querySelectorAll(".project-item");

  filters.forEach(function (filter) {
    filter.addEventListener("click", function () {
      const selectedCategory = this.dataset.filter;

      filters.forEach(function (button) {
        const isActive = button === filter;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });

      projects.forEach(function (project) {
        const shouldShow =
          project.dataset.category === selectedCategory;

        project.classList.toggle("d-none", !shouldShow);
      });
    });
  });
});


document.addEventListener("DOMContentLoaded", function () {
  const rotatingText = document.getElementById("hero-rotating-text");

  if (!rotatingText) return;

  const phrases = [
    "Human-centered design",
    "Scalable design systems",
    "AI-driven experiences",
    "Accessible products",
    "Meaningful user experiences"
  ];

  let currentIndex = 0;

  // Respect the user's reduced-motion preference.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  setInterval(function () {
    rotatingText.classList.add("is-hidden");

    setTimeout(function () {
      currentIndex = (currentIndex + 1) % phrases.length;
      rotatingText.textContent = phrases[currentIndex];
      rotatingText.classList.remove("is-hidden");
    }, 350);
  }, 2500);
});

document.addEventListener("DOMContentLoaded", function () {
  const timelineItems = document.querySelectorAll(".timeline-item");
  const timelineTargets = Array.from(timelineItems)
    .map((item) => {
      const targetId = item.dataset.target || item.dataset.company;
      const target = targetId ? document.getElementById(targetId) : null;

      return target ? { item, target } : null;
    })
    .filter(Boolean);

  function setActive(item) {
    timelineItems.forEach((timelineItem) => {
      timelineItem.classList.remove("active");
      timelineItem.removeAttribute("aria-current");
    });

    item.classList.add("active");
    item.setAttribute("aria-current", "location");
  }

  // Click a company to scroll to its experience section
  timelineItems.forEach((item) => {
    item.addEventListener("click", function () {
      const targetId =
        item.dataset.target ||
        item.dataset.company;

      const target = document.getElementById(targetId);

      setActive(item);

      if (target) {
        target.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start"
        });
      }
    });
  });

  // Update the active company while scrolling
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSections = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              b.intersectionRatio - a.intersectionRatio
          );

        if (visibleSections.length) {
          const activeId = visibleSections[0].target.id;

          const activeEntry = timelineTargets.find(
            ({ target }) => target.id === activeId
          );

          if (activeEntry) {
            setActive(activeEntry.item);
          }
        }
      },
      {
        root: null,
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0, 0.25, 0.5, 0.75]
      }
    );

    timelineTargets.forEach(({ target }) => observer.observe(target));
  }
});

// Project-specific skill badges
document.addEventListener("DOMContentLoaded", function () {
  const projectTriggers = Array.from(
    document.querySelectorAll(".project-hover-trigger[data-project]")
  );
  const skillBadges = document.querySelectorAll(
    ".journey-skills .skill-tags span"
  );
  const skillGroups = document.querySelectorAll(".journey-skills .skill-group");
  const skillsPanel = document.querySelector(".journey-skills");

  if (!skillsPanel || !skillBadges.length) return;

  let hoveredProject = null;
  let visibleProject = null;
  const visibleProjects = new Set();

  function refreshSkills() {
    const activeProject = hoveredProject || visibleProject;
    skillsPanel.classList.toggle("is-project-filtered", Boolean(activeProject));

    skillBadges.forEach(function (badge) {
      const projects = (badge.dataset.projectSkills || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      const isVisible =
        !activeProject || projects.includes(activeProject);

      badge.classList.toggle("is-visible", isVisible);
      badge.setAttribute("aria-hidden", String(!isVisible));
    });

    skillGroups.forEach(function (group) {
      const hasVisibleBadges = group.querySelector(
        ".skill-tags span.is-visible"
      );
      group.classList.toggle(
        "is-empty",
        Boolean(activeProject) && !hasVisibleBadges
      );
    });
  }

  projectTriggers.forEach(function (trigger) {
    const projectId = trigger.dataset.project;

    trigger.addEventListener("mouseenter", function () {
      hoveredProject = projectId;
      refreshSkills();
    });

    trigger.addEventListener("mouseleave", function () {
      hoveredProject = null;
      refreshSkills();
    });

  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            visibleProjects.add(entry.target);
          } else {
            visibleProjects.delete(entry.target);
          }
        });

        const activationY = window.innerHeight * 0.35;
        const activeTarget = Array.from(visibleProjects)
          .map(function (target) {
            const bounds = target.getBoundingClientRect();
            const distance =
              activationY < bounds.top
                ? bounds.top - activationY
                : activationY > bounds.bottom
                  ? activationY - bounds.bottom
                  : 0;

            return { target, distance };
          })
          .sort(function (a, b) {
            return a.distance - b.distance;
          })[0];

        visibleProject = activeTarget
          ? activeTarget.target.dataset.project
          : null;
        refreshSkills();
      },
      {
        rootMargin: "-32% 0px -62% 0px",
        threshold: 0
      }
    );

    projectTriggers.forEach(function (trigger) {
      observer.observe(trigger);
    });
  }

  refreshSkills();
});

document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById("timeOffCaseStudy");

  if (!modal) return;

  let modalOpener = null;

  modal.addEventListener("show.bs.modal", function (event) {
    if (event.relatedTarget instanceof HTMLElement) {
      modalOpener = event.relatedTarget;
    }
  });

  modal.addEventListener("hidden.bs.modal", function () {
    if (modalOpener && modalOpener.isConnected) {
      modalOpener.focus();
    }
  });
});
