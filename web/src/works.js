// Content for the work modal, keyed by each card's `data-work` attribute.
// Leave `company` null for independent projects — the modal shows
// "Independent" in its place. `role` is optional and only shown when set.
// All copy and callout images are placeholders.

const placeholderBody =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.";

const placeholderSummary =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante venenatis dapibus, posuere velit aliquet. Donec ullamcorper nulla non metus auctor fringilla, vestibulum id ligula porta felis euismod semper.";

export const works = {
  "Journey to the Sambaverse": {
    title: "Journey to the Sambaverse",
    year: "2024",
    company: null,
    summary: placeholderSummary,
    callouts: [
      {
        title: "Real-time world building",
        body: placeholderBody,
        image: "/assets/images/Thumbnail_JourneyToTheSambaVerse.jpg",
      },
      {
        title: "Audio-reactive visuals",
        body: placeholderBody,
        image: "/assets/images/Thumbnail_Panic.jpg",
      },
      {
        title: "Camera and choreography",
        body: placeholderBody,
        image: "/assets/images/Thumbnail_HandheldGuy.jpg",
      },
    ],
  },

  "Jadu Fight": {
    title: "Jadu Fight",
    year: "2023",
    company: "Jadu",
    summary: placeholderSummary,
    callouts: [
      {
        title: "Combat systems",
        body: placeholderBody,
        image: "/assets/images/Thumbnail_JaduFight.jpg",
      },
      {
        title: "Avatar pipeline",
        body: placeholderBody,
        image: "/assets/images/Thumbnail_JourneyToTheSambaVerse.jpg",
      },
      {
        title: "Networked multiplayer",
        body: placeholderBody,
        image: "/assets/images/Thumbnail_Panic.jpg",
      },
    ],
  },

  "Handheld Guy": {
    title: "Handheld Guy",
    year: "2022",
    company: null,
    summary: placeholderSummary,
    callouts: [
      {
        title: "Character design",
        body: placeholderBody,
        image: "/assets/images/Thumbnail_HandheldGuy.jpg",
      },
      {
        title: "Hardware prototyping",
        body: placeholderBody,
        image: "/assets/images/Thumbnail_JaduFight.jpg",
      },
    ],
  },

  Panic: {
    title: "Panic",
    year: "2021",
    company: null,
    summary: placeholderSummary,
    callouts: [
      {
        title: "Motion design",
        body: placeholderBody,
        image: "/assets/images/Thumbnail_Panic.jpg",
      },
      {
        title: "Turnaround under pressure",
        body: placeholderBody,
        image: "/assets/images/Thumbnail_HandheldGuy.jpg",
      },
    ],
  },

  "Curse of Calypso": {
    title: "Curse of Calypso",
    year: "2021",
    company: "Jadu",
    role: "Unity Developer",
    summary:
      "An augmented reality experience from Palaye Royale, built at Jadu.",
    callouts: [
      {
        title: "Augmented reality storytelling",
        body: placeholderBody,
        image: "/assets/images/cocposter.jpeg",
      },
      {
        title: "Volumetric performances",
        body: placeholderBody,
        image: "/assets/images/cocposter.jpeg",
      },
    ],
  },
};
