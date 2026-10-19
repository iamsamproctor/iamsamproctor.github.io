// Content for the work modal, keyed by each card's `data-work` attribute.
// Leave `company` null for independent projects — the modal shows
// "Independent" in its place. `role` is optional and only shown when set.
// `tools` is optional: names, or { name, use } to note what a tool was for.
// A callout shows its `video` (looping, with `image` as the poster), else
// its `image`, else a plain grey box standing in until there's media.

const placeholderBody =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.";

const placeholderSummary =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante venenatis dapibus, posuere velit aliquet. Donec ullamcorper nulla non metus auctor fringilla, vestibulum id ligula porta felis euismod semper.";

export const works = {
  "Journey to the Sambaverse": {
    title: "Journey to the Sambaverse",
    year: "2025",
    company: null,
    summary:
      "An experiment in augmented reality, interactive storytelling, and game design. \"Journey to the SambaVerse\" began as a one-week creative challenge: to tell a whimsical story through AR. Created for a themed teepee experience at an annual group camping trip, it brought together outer space and samba into a five-minute AR minigame performed for live audiences.",
    tools: [
      "Unity",
      "C#",
      "AR Foundation",
      { name: "Logic Pro", use: "audio" },
      { name: "Blender", use: "3D assets" },
    ],
    callouts: [
      {
        title: "The Experience",
        body: [
          "Presented through mobile AR, Journey to the SambaVerse invited audiences to peer into a miniature alien world projected onto a tabletop. The story followed a small alien on a mission to restore happiness to Samba-Land by collecting musical crystals to magically repair DJ equipment \u2014 a nod to the camping community's shared love of music and DJing.",
          "After a brief dialogue-driven introduction, the experience transitioned into a survival dodging game in AR, in which an alien must dodge incoming asteroids while trying to collect floating energy crystals. It was presented as a live, interactive storybook: I guided the character while narrating the adventure to an audience gathered around the screen and cheering me on as I played my own game.",
        ],
        image: "/assets/images/Thumbnail_JourneyToTheSambaVerse.jpg",
        video: "/assets/videos/Sambaverse_TextBubble.mp4",
      },
      {
        title: "Designing for Spatial Perception",
        body: "Built in Unity over the course of a week, the project meant adapting conventional game mechanics to AR. One early discovery was how difficult it is to judge vertical distances through a mobile AR camera. Movement along the horizontal plane was intuitive, but a character's position relative to objects above or below it was much harder to read. To accommodate this, I constrained asteroid movement to the horizontal X and Z axes, making obstacles easier to anticipate and avoid.",
        video: "/assets/videos/Sambaverse_2DDodger.mp4",
      },
      {
        title: "Gameplay Environment",
        body: "The experience used a physical tabletop as its ground plane, with an additional vertical surface serving as the backdrop for the virtual environment. Crucially, I had to make sure that my surface and backdrop were textured in some meaningful way in order for ARKit to properly anchor the game.",
        video: "/assets/videos/Sambaverse_Placement.mp4",
      },
      {
        title: "Making Use of Vertical Planes",
        body: [
          "I wanted to find a meaningful way to incorporate vertical planes into the gameplay. To do this, I introduced a wall that acted as a physical barrier, causing moving objects to bounce back upon collision. However, I also wanted asteroids to approach from all directions, rather than just from the front. To accommodate both behaviors, I needed a system that would allow asteroids to pass through the wall from behind while colliding with it when approaching from the opposite direction.",
        ],
        more: {
          label: "How it works",
          body:
            "Using the dot product, I compared each asteroid's travel direction against the wall's surface normal. Based on their alignment, I selectively disabled collisions between individual asteroids and tagged vertical planes using Unity's Physics.IgnoreCollision, restoring them after a short delay. Asteroids could enter the playable space without immediately hitting the backdrop, while the boundary still read as solid once they had passed through.",
        },
        video: "/assets/videos/Sambaverse_BouncingRocks.mp4",
      },
      {
        title: "Designing for an Unfamiliar Medium",
        body: [
          "The audience responded enthusiastically to the story and visuals, but inviting participants to control the character revealed that the mechanics weren't immediately intuitive to everyone. During one demonstration, a child struggled with the virtual joystick and inadvertently moved the character entirely out of view.",
          "Having spent years developing and interacting with AR experiences, I'd taken for granted how intuitive these controls had become to me, overlooking the learning curve that comes with experiencing this medium for the first time.",
          "Ultimately, the project worked best as a narrated performance, with me guiding the gameplay much like turning the pages of an interactive picture book.",
        ],
        video: "/assets/videos/Sambaverse_CharacterControl.mp4",
      },
      {
        title: "Exploring AR as a Storytelling Medium",
        body: "Despite its limited scope and short timeline, Journey to the SambaVerse offered a glimpse into the possibilities of AR as a storytelling medium. It was very enriching watching an audience react with excitement and curiosity to the miniature world I created. I was especially proud to showcase how the structure of the physical world became part of the gameplay itself.",
        image: "/assets/images/Thumbnail_JourneyToTheSambaVerse.jpg",
        video: "/assets/videos/Sambaverse_Showing.mp4",
      },
      {
        title: "The Alien Dance Party",
        body: "And of course, I needed an alien dance party as a reward for winning.",
        image: "/assets/images/Thumbnail_JourneyToTheSambaVerse.jpg",
        video: "/assets/videos/Sambaverse_DanceParty.mp4",
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
      },
      {
        title: "Avatar pipeline",
        body: placeholderBody,
      },
      {
        title: "Networked multiplayer",
        body: placeholderBody,
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
      },
      {
        title: "Hardware prototyping",
        body: placeholderBody,
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
      },
      {
        title: "Turnaround under pressure",
        body: placeholderBody,
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
      },
      {
        title: "Volumetric performances",
        body: placeholderBody,
      },
    ],
  },
};
