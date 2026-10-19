// Content for the work modal, keyed by each card's `data-work` attribute.
// Leave `company` null for independent projects — the modal shows
// "Independent" in its place. `role` is optional and only shown when set.
// `tools` is optional: names, or { name, use } to note what a tool was for.
// `stats` is optional too: { value, label } pairs shown large above the
// summary, with `statsNote` as a small line under them (e.g. "as of" when).
// `link` is an optional { label, url }, shown as a button that opens in a
// new tab.
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
    title: "JADU: Fight comes to your Room",
    year: "2023",
    company: "Jadu",
    role: "Gameplay Engineer",
    summary:
      "JADU: Fight comes to your Room began with a simple challenge: make a 3D character walk around in augmented reality. Over time, that experiment grew into a multiplayer fighting game, with character customization, elaborate combat animations, AI opponents, and an expanding set of gameplay systems.",
    stats: [
      { value: "4.8", label: "Stars on the App Store" },
      { value: "1M+", label: "Multiplayer AR fights" },
      { value: "10K", label: "Active players" },
    ],
    statsNote: "As of October 2026, with no updates since 2024.",
    link: { label: "View on the App Store", url: "https://apps.apple.com/us/app/jadu/id6443662349" },
    tools: ["Unity", "C#", "AR Foundation", { name: "Normcore", use: "multiplayer" }],
    // Every section is a grey box until footage is in; the comment above
    // each one says what it's waiting for.
    callouts: [
      // Finished AR combat, ideally cutting between different real-world places.
      {
        title: "Bringing a Fighting Game into the Real World",
        body: [
          "I worked as a gameplay engineer on the team, focusing primarily on character movement, animation, combat implementation, NPC behavior, and multiplayer animation integration. As the project evolved, so did my responsibilities — from getting a character moving with a virtual joystick to helping build and refine the systems that made combat feel responsive and expressive.",
          "The defining challenge was that we couldn't predict where anyone would play. A player might launch the game in an open field or a cluttered bedroom. We had to create gameplay that could adapt to both.",
        ],
      },
      // The early joystick prototype, detected planes, a fallback-plane before/after.
      {
        title: "A Character Controller for an Unpredictable World",
        body: [
          "My first task was to get a character walking in AR. I started by combining existing Unity character-controller resources with mobile joystick input, then learned to retarget humanoid animations onto the supplied character model. I integrated that work with our AR placement system so players could place a character into their surroundings and move it across detected surfaces.",
          "That first prototype quickly revealed how different AR was from a conventional game environment. AR Foundation relied on the device's understanding of the world, and that understanding was incomplete. Ground planes might end unexpectedly, walls could be misidentified, and overlapping surfaces could trap the character's collider.",
          "We explored safeguards such as a fallback plane beneath detected ground surfaces to keep characters from disappearing when tracking failed to extend far enough. But every solution involved a tradeoff: preventing a character from falling into empty space might also prevent it from falling off a real balcony. The challenge wasn't to reproduce physical reality perfectly. It was to make the experience dependable and enjoyable despite imperfect environmental data.",
        ],
      },
      // Walking into a jetpack, the hoverboard at different scales, both at once.
      {
        title: "Jetpacks and Hoverboards",
        body: [
          "Free roaming soon expanded beyond walking. We introduced jetpacks and hoverboards, and I added movement states to the existing character controller to support them. Unlike our initial animation-driven movement, these modes relied on code to control character motion.",
          "Jetpacks introduced continuous thrust, vertical movement, and a new set of tuning problems: acceleration, gravity, floating, turning, and altitude limits. In AR, the player isn't following the character with a traditional game camera; the view is anchored to their phone. That made unrestricted flight impractical, so the movement had to be designed around the viewing experience.",
          "I also collaborated with a lead engineer on hoverboard behavior, helping tune its physics and handling across different object scales. We even experimented with using jetpacks and hoverboards simultaneously. As the movement systems grew, I contributed to the team's shift toward more controlled, kinematic character movement and collision handling.",
        ],
      },
      // An avatar lineup, a retargeting comparison, combat characters' moves.
      {
        title: "One Game, Thousands of Avatars",
        body: [
          "JADU supported numerous third-party avatar collections in free roam, representing thousands of unique characters, alongside proprietary characters designed for combat. Integrating them wasn't simply a matter of importing models: each needed to behave correctly with the movement and animation systems.",
          "I worked with technical artists to validate humanoid skeletons, skinning, scale, and materials, and to ensure animations retargeted properly. Third-party avatars generally shared a standard animation setup, sometimes with custom idles or emotes, while combat characters required more specialized animation support. I didn't build the character customization itself; my part was making the characters work with the gameplay and animation systems around them.",
        ],
      },
      // Free-roam movement against combat strafing, locking on and letting go.
      {
        title: "From Free Roam to Fighting Game",
        body: [
          "Turning a free-roaming AR experience into a fighting game required us to rethink how characters moved. Unrestricted, omnidirectional movement felt natural for exploration, but it didn't always feel right when two fighters faced each other.",
          "I prototyped opponent-facing movement and strafing behavior, using animation states to control when a character's rotation should remain locked toward an opponent and when it should be released. During certain attacks, for example, that lock needed to disengage so the movement and dodging interactions could play out naturally, then return afterward.",
          "This was one of many places where the correct technical behavior wasn't necessarily the best gameplay behavior. We had to test, adjust, and develop a feel for what made the combat readable and satisfying.",
        ],
      },
      // A punch into a kick, a charged attack, a cropped look at the Animator graph.
      {
        title: "Building the Combat Animation System",
        body: [
          "My work sat at the intersection of combat logic and character animation. Together with other gameplay engineers, I contributed to a shared combat architecture; I took particular ownership of movement, animation behavior, and implementing new attacks with the animation team.",
          "One of my most involved contributions was a combo system that could chain attacks through intermediate animation segments. A standalone punch might move from idle to the punch's apex and back to idle. A punch-kick combo could instead transition from the punch apex directly into the kick apex before returning to idle. The system supported longer chains and required input to arrive during the appropriate window of the current move.",
          "The goal was more than making animations play correctly. It was making combat feel immediate, fluid, and intentional.",
        ],
        more: {
          label: "Inside the state machine",
          body: "I built and maintained a large Animator state machine, roughly a hundred states, covering different attacks, transitions, charged moves, and reactions. Much of the challenge was managing responsiveness: deciding which animations could be interrupted, clearing stale triggers, and preventing buffered inputs from causing unintended moves after an action had finished.",
        },
      },
      // Contrasting NPC personalities, the same fighter on easy and hard.
      {
        title: "NPCs With Personality",
        body: [
          "I owned substantial portions of our NPC behavior implementation. Rather than using machine learning or a formal behavior-tree framework, I built rule-based behaviors in C#, coordinating movement, attack selection, and defensive reactions.",
          "Making the AI functional was only the beginning. I spent extensive time playtesting with the team, adjusting reaction delays, attack frequency, defense timing, randomness, and move variety. Too little aggression made an opponent trivial; too much made it feel unfair. Instant shielding could make an NPC seem superhuman rather than skilled.",
          "Eventually, we separated personality from difficulty, allowing the same fighting style to appear at easier or harder settings. This work taught me that good game AI isn't about making the strongest possible opponent. It's about creating an encounter that players want to engage with.",
        ],
        more: {
          label: "How the behaviors work",
          body: "NPC profiles let us define different fighting tendencies. Some opponents preferred to close the distance; others kept their range or favored projectiles. Weighted attack selection influenced whether they leaned toward punches, kicks, or ranged moves. Combat priorities also mattered: taking damage could cancel an attack and force a reaction state, during which the NPC couldn't simply continue attacking.",
        },
      },
      // Both devices' recordings of one match side by side, a coordinated move up close.
      {
        title: "Bringing Combat Online",
        body: [
          "Multiplayer introduced another layer of complexity: two devices had to present the same fight convincingly. The team integrated Normcore, with each client generally controlling its own avatar state while receiving the opponent's state and combat events.",
          "My primary responsibility was integrating avatar and animation behavior into that networked experience. I worked to ensure animation parameters and combat information produced the correct moves and reactions on both devices, across different supported avatar collections.",
          "Certain interactions were particularly sensitive. A punch followed by a delayed damage reaction looked wrong even when the underlying gameplay event had registered. Coordinated moves sometimes required temporary control over an opponent's position, followed by resynchronization. I worked within that system and occasionally adjusted the relevant ownership code in collaboration with the engineer who designed it.",
        ],
        more: {
          label: "How we debugged it",
          body: "Debugging was painstaking and practical: recording both devices, running multiple editor instances, comparing Animator states, and repeatedly isolating individual moves or triggers. Those tests helped us identify where the two clients' visual experiences diverged.",
        },
      },
      // A short montage from the first walking prototype to finished multiplayer combat.
      {
        title: "What JADU Taught Me",
        body: [
          "I joined this work early in my game-development career. At first, my focus was straightforward: learn the tools, solve the assigned problem, and get the feature working. As the game grew, I began taking ownership of larger systems and collaborating more closely across gameplay engineering, animation, and technical art.",
          "My technical understanding deepened, but the most meaningful change was in my judgment. I developed a stronger sense of how movement should feel, when an animation wasn't responsive enough, and why an opponent could be challenging without being fun. I became more confident offering feedback and helping shape the experience — not just implementing what had already been decided.",
          "JADU taught me that engineering and creative judgment aren't separate disciplines. The most rewarding problems often live where they meet.",
        ],
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
