
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
  const sections = document.querySelectorAll(
    ".experience-section, [id^='tek-'], [id^='tescra-'], [id^='sagarsoft-'], [id^='neudesic-'], [id^='liquidhub-']"
  );

  function setActive(item) {
    timelineItems.forEach((timelineItem) => {
      timelineItem.classList.remove("active");
    });

    item.classList.add("active");
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
          behavior: "smooth",
          block: "start"
        });
      }
    });

    // Temporarily highlight on hover
    item.addEventListener("mouseenter", function () {
      item.classList.add("hovered");
    });

    item.addEventListener("mouseleave", function () {
      item.classList.remove("hovered");
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

          const activeItem = Array.from(timelineItems).find(
            (item) =>
              item.dataset.target === activeId ||
              item.dataset.company === activeId
          );

          if (activeItem) {
            setActive(activeItem);
          }
        }
      },
      {
        root: null,
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0, 0.25, 0.5, 0.75]
      }
    );

    sections.forEach((section) => observer.observe(section));
  }
});

// Project-specific skill badges
document.addEventListener("DOMContentLoaded", function () {
  const projectTriggers = document.querySelectorAll(".project-hover-trigger");
  const skillBadges = document.querySelectorAll(
    ".journey-skills .skill-tags span[data-project-skills]"
  );

  if (!projectTriggers.length || !skillBadges.length) return;

  let selectedProject = "time-off";
  let hoveredProject = null;

  function showProjectSkills(projectId) {
    skillBadges.forEach(function (badge) {
      const projects = badge.dataset.projectSkills
        .trim()
        .split(/\s+/);

      const isVisible = projects.includes(projectId);

      badge.classList.toggle("is-visible", isVisible);
      badge.setAttribute("aria-hidden", String(!isVisible));
    });
  }

  function refreshSkills() {
    showProjectSkills(hoveredProject || selectedProject);
  }

  projectTriggers.forEach(function (trigger) {
    const projectId = trigger.dataset.project;

    if (!projectId) return;

    trigger.addEventListener("mouseenter", function () {
      hoveredProject = projectId;
      refreshSkills();
    });

    trigger.addEventListener("mouseleave", function () {
      hoveredProject = null;
      refreshSkills();
    });

    trigger.addEventListener("focusin", function () {
      hoveredProject = projectId;
      refreshSkills();
    });

    trigger.addEventListener("focusout", function (event) {
      if (!trigger.contains(event.relatedTarget)) {
        hoveredProject = null;
        refreshSkills();
      }
    });

    trigger.addEventListener("click", function () {
      selectedProject = projectId;
      refreshSkills();
    });
  });

  showProjectSkills(selectedProject);
});