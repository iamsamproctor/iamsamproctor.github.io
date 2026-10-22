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
      "JADU: Fight comes to your Room began with a simple experiment: make a 3D character walk around your room in augmented reality. Over time, that experiment grew into a multiplayer fighting game, with character customization, elaborate combat animations, AI opponents, and an expanding set of gameplay systems.",
    stats: [
      { value: "4.8", label: "Stars on the App Store" },
      { value: "1M+", label: "Multiplayer AR fights" },
      { value: "10K", label: "Active players" },
    ],
    statsNote: "As of October 2026, with no updates since 2024.",
    link: { label: "View on the App Store", url: "https://apps.apple.com/us/app/jadu/id6443662349" },
    tools: ["Unity", "C#", "AR Foundation", { name: "Normcore", use: "multiplayer" }],
    // A section is a grey box until its footage is in; the comment above
    // each one still waiting says what it's waiting for.
    callouts: [
      {
        title: "Bringing a Fighting Game into the Real World",
        video: "/assets/videos/JaduFight_OfficeMatch.mp4",
        // The phone's view is composited down the right side.
        fullFrame: true,
        body: [
          "I worked as a gameplay engineer on the team, focusing primarily on character control, animation, combat implementation, NPC behavior, and multiplayer systems. As the project evolved, so did my responsibilities, from getting a character moving with a virtual joystick to helping build and refine the systems that made combat feel responsive and expressive.",
          "The defining challenge was that we couldn't predict where anyone would play. A player might launch the game in an open field or a cluttered bedroom. We had to create gameplay that could adapt to both.",
        ],
        quote:
          "The defining challenge was that we couldn't predict where anyone would play. A player might launch the game in an open field or a cluttered bedroom. We had to create gameplay that could adapt to both.",
      },
      {
        title: "A Character Controller for an Unpredictable World",
        video: "/assets/videos/JaduFight_MeebitStairs.mp4",
        aspect: 768 / 1600,
        body: [
          "My first task was to get a character walking in AR. I started by combining existing Unity character-controller resources with mobile joystick input, retargeting stock-humanoid animations onto the supplied character model, a [Meebit](https://meebits.com/collection).",
          "Combined with our existing AR placement system, a player could place a character into their surroundings, and now, move it across detected surfaces.",
          "That first prototype quickly revealed how different AR was from a conventional game environment. AR Foundation relied on the device's understanding of the world, and that understanding was incomplete. Ground planes might end unexpectedly, walls could be misidentified, and overlapping surfaces could trap the character's collider.",
          "We explored safeguards such as a fallback plane beneath detected ground surfaces to keep characters from disappearing when tracking failed to extend far enough. But every solution involved a tradeoff: preventing a character from falling into empty space might also prevent it from falling off a real balcony.",
          "Ultimately, our goal was to make the experience dependable and enjoyable despite imperfect environmental data.",
        ],
      },
      {
        title: "Jetpacks and Hoverboards",
        video: ["/assets/videos/JaduFight_Jetpack.mp4", "/assets/videos/JaduFight_Hoverboard.mp4"],
        aspect: 768 / 1600,
        body: [
          "Free roaming soon expanded beyond walking. We introduced jetpacks and hoverboards, and I added movement states to the existing character controller to support them.",
          "Jetpacks introduced continuous thrust, vertical movement, and a new set of tuning problems: acceleration, gravity, floating, turning, and altitude limits. In AR, the player isn't following the character with a traditional game camera; the view is anchored to their phone. That made unrestricted flight impractical, so the movement had to be designed around the viewing experience.",
          "I collaborated with fellow game engineers on hoverboard behavior, helping tune its physics and handling across different object scales. We even added support for using jetpacks and hoverboards simultaneously.",
          "As the movement systems grew over time, I contributed to the team's shift toward more controlled, kinematic character movement and collision handling.",
        ],
      },
      {
        title: "One Game, Thousands of Avatars",
        image: "/assets/images/JaduFight_AvatarScaleChart.jpg",
        // A chart: shown whole, on its own black, and barely faded.
        letterbox: "#000",
        fullFrame: true,
        body: [
          "JADU supported numerous third-party avatar collections in free roam, representing thousands of unique characters, alongside proprietary characters designed for combat.",
          "Every model had to work with the movement and animation systems, and the avatars varied enormously. Body types ranged widely, skeleton structures differed, and each collection had its own needs. To handle that, I created a comprehensive document for our partners that set out the requirements for supporting their avatar collections. I then worked directly with those partners to onboard their models into our ecosystem.",
          "From there, I worked with 3D and technical artists to validate humanoid skeletons, skinning, scale, and materials, and to ensure animations retargeted properly. Third-party avatars generally shared a standard animation setup, sometimes with custom idles or emotes, while combat characters required more specialized animation support.",
        ],
      },
      {
        title: "From Free Roam to Fighting Game",
        video: "/assets/videos/JaduFight_Strafing.mp4",
        // The fighters circle out toward the text side.
        fullFrame: true,
        body: [
          "Turning a free-roaming AR experience into a fighting game meant rethinking how characters moved. Unrestricted, omnidirectional movement felt natural for exploration, but not for combat.",
          "I researched games like Street Fighter and Tekken and realized that movement in them is generally restricted to a single axis (forward and backward), so opponents spend most of the time facing each other.",
          "To add a second axis (left/right movement), I prototyped opponent-facing movement with strafing, which moved a character in an arc around their opponent. At certain moments (such as during actual attack moves), my code temporarily disengaged the player's rotation lock, so that an opponent could actually dodge an incoming attack.",
          "After experimenting with variables like rotation lock, speed modulation, and cooldown timing, and working closely with our animation team, we gradually shaped the movement into the system in the product today.",
        ],
      },
      {
        title: "Building the Combat Animation System",
        video: "/assets/videos/JaduFight_ComboMoves.mp4",
        aspect: 694 / 1080,
        body: [
          "Much of my work sat at the intersection of combat logic and character animation. Together with other gameplay engineers, I contributed to a shared combat architecture; I took particular ownership of movement, animation behavior, and implementing new attacks with the animation team.",
          "One of my most involved contributions was a combo system that could chain attacks through intermediate animation segments. A standalone punch might move from idle to the punch's apex and back to idle. A punch-kick combo could instead transition from the punch apex directly into the kick apex before returning to idle. The system supported longer chains and required input to arrive during the appropriate window of the current move.",
          "The goal was to make combat feel immediate, fluid, and intentional, and getting animations to play correctly was only part of that.",
        ],
        more: {
          label: "Inside the state machine",
          body: "I built and maintained a large Animator state machine, roughly a hundred states, covering different attacks, transitions, charged moves, and reactions. Much of the challenge was managing responsiveness: deciding which animations could be interrupted, clearing stale triggers, and preventing buffered inputs from causing unintended moves after an action had finished.",
        },
      },
      {
        title: "NPCs With Personality",
        video: "/assets/videos/JaduFight_NPCs.mp4",
        aspect: 1136 / 910,
        body: [
          "I owned substantial portions of our NPC behavior implementation. Rather than using machine learning or a formal behavior-tree framework, I built rule-based behaviors in C#, coordinating movement, attack selection, and defensive reactions.",
          "Making the AI functional was only the beginning. I spent extensive time playtesting with the team, adjusting reaction delays, attack frequency, defense timing, randomness, and move variety. Too little aggression made an opponent trivial; too much made it feel unfair. Behaviors like instant shielding could make an NPC seem superhuman rather than skilled.",
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
          "Certain interactions were particularly sensitive. A punch followed by a delayed damage reaction looked wrong even when the underlying gameplay event had registered. Coordinated moves sometimes required temporary control over an opponent's position, followed by resynchronization. I worked within that system and occasionally adjusted the relevant ownership code in collaboration with other engineers on the team.",
        ],
        more: {
          label: "How we debugged it",
          body: "Debugging was painstaking and practical: recording both devices, running multiple editor instances, comparing Animator states, and repeatedly isolating individual moves or triggers. Those tests helped us identify where the two clients' visual experiences diverged.",
        },
      },
      // A short montage from the first walking prototype to finished multiplayer combat.
      {
        title: "What Making an AR Combat Game Taught Me",
        body: [
          "This project was an early one in my game-dev career. Initially, my focus was straightforward: learn the tools, solve the assigned problem, and get the feature working. But as the game and codebase grew, so did I. I began taking ownership of larger systems and collaborating more closely across engineering, animation, and technical art.",
          "My technical understanding certainly deepened, but the most meaningful change was in my judgment. I developed a stronger sense of how movement should feel, when an animation wasn't responsive enough, and why an opponent could be challenging without being fun. I became more confident offering feedback and helping shape the experience, rather than simply implementing what had already been decided.",
          "JADU taught me that engineering and creative judgment are intertwined disciplines, and the most rewarding problems often live where they meet.",
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
    title: "PANIC: AR Shooter",
    year: "2025",
    company: "Jadu",
    role: "Gameplay Engineer",
    summary:
      "PANIC: AR Shooter brings a fast-paced, miniature shooter into the player's physical environment. Enemies swarm from every direction, projectiles fly across the room, and larger-than-life bosses turn familiar spaces into arenas.",
    // Public App Store figures; player numbers would have to come from Jadu.
    stats: [
      { value: "4.9", label: "Stars on the App Store" },
      { value: "379", label: "App Store ratings" },
    ],
    statsNote: "As of October 2026, with no updates since July 2025.",
    link: { label: "View on the App Store", url: "https://apps.apple.com/us/app/panic-ar-shooter/id6742031888" },
    tools: [
      "Unity",
      "C#",
      "AR Foundation",
      { name: "DOTS / Entities", use: "ECS" },
      { name: "Mecanim", use: "animation" },
      { name: "Unity Behavior", use: "boss encounters" },
      "Final IK",
    ],
    // A section is a grey box until its footage is in; the comment above
    // each one still waiting says what it's waiting for.
    callouts: [
      {
        title: "A Battlefield in Your Living Room",
        video: "/assets/videos/Panic_ShootingAliens.mp4",
        aspect: 498 / 980,
        body: "As a gameplay engineer at Jadu, I worked across character animation, combat systems, audio integration, and boss encounters. My role often sat at the intersection of engineering and game design: developing mechanics, shaping how they felt to play, and collaborating with artists, designers, and other engineers to bring them to life.",
      },
      {
        title: "Learning to Think in Data",
        video: "/assets/videos/Panic_Flamethrower.mp4",
        aspect: 1,
        body: [
          "To support large numbers of enemies and projectiles on mobile, the project used Unity's Data-Oriented Technology Stack (DOTS) and Entity Component System (ECS). It was a significant shift from the GameObject-based Unity workflows I knew best, and much of the team was learning alongside me.",
          "ECS encouraged us to organize behavior around data and systems rather than individual objects. It changed how I approached everything from collisions and movement to animation and audio. Some seemingly simple features required a new way of thinking, especially when they needed to communicate with Unity tools that still lived outside ECS.",
        ],
      },
      {
        title: "Making a Miniature Character Feel Responsive",
        video: "/assets/videos/Panic_SwapAndShoot.mp4",
        aspect: 1416 / 998,
        body: [
          "A large part of my work centered on the player character's animation. I implemented and refined movement, strafing, turning in place, shooting, reloading, weapon swaps, jumping, and double jumping, working closely with the animation and gameplay teams.",
          "The character needed to feel responsive while performing several actions at once. I used blend trees for directional movement and layered animation so the upper body could handle weapons and aiming while the lower body continued moving. I also added subtle stepping animations when the character rotated in place, helping their feet feel grounded instead of sliding across the floor.",
        ],
      },
      {
        title: "Connecting Animation to Gameplay",
        // The jump in play, beside the editor showing what drives it.
        video: ["/assets/videos/Panic_ChairHopping.mp4", "/assets/videos/Panic_PlayerJumpEditor.mp4"],
        aspect: [610 / 1200, 1920 / 1080],
        captions: ["In game", "In the editor"],
        body: [
          "One of my favorite challenges was synchronizing the jump animation with the character's actual movement. If the physics impulse happened as soon as the input was received, the character could rise before the animation visually communicated a jump.",
          "I used an animation event to signal the ECS gameplay system at the moment of takeoff. That let the character anticipate the movement before the physical jump began, bringing the animation and simulation into closer alignment. The same principle was useful elsewhere, including timing enemy melee damage to the moment an attack connected visually.",
        ],
        more: {
          label: "Animation in an ECS game",
          body: [
            "Our gameplay simulation ran in ECS, while character animation relied on Unity's conventional Mecanim Animator. Integrating the two meant keeping animation parameters, events, and character state in sync across different parts of the engine.",
            "I worked within and extended this shared architecture to make animation-driven gameplay possible. It was a recurring lesson in practical engineering: the best solution often involved understanding where different systems met and designing a reliable connection between them.",
          ],
        },
      },
      {
        title: "Giving the Action Sound and Feedback",
        video: "/assets/videos/Panic_SoundExample.mp4",
        aspect: 610 / 1200,
        // Its own sound is the point, so it offers a button to hear it.
        listen: true,
        body: [
          "Sound was another important part of making PANIC's world feel alive. Working with our sound designer and fellow engineers, I integrated audio across weapons, enemies, pickups, environmental interactions, and boss encounters.",
          "I worked closely with our principal engineer to develop and extend the game's central ECS audio architecture based on gameplay and sound design needs. I used that system to connect gameplay events with the appropriate sounds, while also working on details such as spatial distance, volume controls, and how overlapping voice lines should behave.",
          "Many sounds needed to follow what was happening in the game rather than simply play once. Unlocking a chest, for example, takes a moment to charge, and its charging sound responds to the same gameplay state that drives the unlock, so what the player hears matches what they see.",
          "Details like these reinforced an important principle: audio, haptics, animation, and gameplay should communicate the same thing to the player.",
        ],
        quote: "Audio, haptics, animation, and gameplay should communicate the same thing to the player.",
      },
      // The bosses' reveal: TukTuk and Absynthe.
      {
        title: "From an Open-Ended Brief to a Playable Fight",
        body: [
          "When our team decided to introduce boss fights, I was given an open-ended assignment to prototype an encounter. I researched boss battles, drew on my own experience playing games, and began exploring how phases, attack patterns, recovery windows, and enemy swarms could create a satisfying rhythm.",
          "I developed and presented an initial multi-phase prototype, then helped turn those ideas into the encounters with TukTuk and Absynthe. This became one of the most rewarding parts of the project because I could contribute directly to the design of the experience while also building the systems that made it work.",
        ],
      },
      // A cropped behavior graph beside a fight changing phase and recovering.
      {
        title: "Designing a Rhythm of Pressure and Release",
        body: [
          "The encounters progressed through three attack phases, separated by recovery moments. Bosses could use melee attacks, launch projectiles, trigger ground-pound shockwaves, and bring additional enemies into the fight. Their behavior changed as the player advanced, creating a rhythm of pressure, opportunity, and escalation.",
          "I assembled the encounters using Unity Behavior graphs, coordinating animations, attacks, shields, enemy spawns, visual effects, music, and transitions between phases. I collaborated with engineers who extended the behavior framework, artists who created effects and assets, and designers who helped tune the fights.",
        ],
      },
      // The ground pound, and a top-down diagram of the damage ring moving out
      // with it (check its labels against the footage or source first).
      {
        title: "A Shockwave That Behaves Like a Ring",
        body: [
          "One attack presented a particularly interesting collision problem. The boss would slam the ground, sending an expanding shockwave outward. The damaging area needed to follow the moving edge of the wave rather than fill the entire circle behind it.",
          "I implemented a ring-shaped damage region using concentric collision volumes. The outer volume defined the wave's reach, while the inner volume excluded the area the shockwave had already passed. By detecting when the player was inside the outer boundary but outside the inner one, I could make damage correspond to the advancing wave.",
          "This was a satisfying example of solving a gameplay problem with simple geometry and ECS collision logic, while keeping the result aligned with the visual effect.",
        ],
      },
      // A boss reel: head tracking, homing shots, the health bar, minions, a defeat.
      {
        title: "Bringing the Encounters Together",
        body: [
          "Beyond the core attack patterns, I worked on supporting features including homing projectiles, boss head-tracking, world-space health bars, minion spawning behavior, animation and audio integration, and encounter tuning. Each piece helped make the bosses feel more like characters occupying the player's room.",
          "Building these encounters meant moving constantly between design decisions and technical implementation: imagining what the player should experience, finding a way to express it in the available systems, and refining the result through playtesting and feedback.",
        ],
      },
      // A closing shot: a character or boss in an everyday room.
      {
        title: "Learning Across Disciplines",
        body: [
          "Working on PANIC made me a more well-rounded developer and game designer. Learning ECS challenged me to think about programming from a different perspective, with a greater appreciation for memory layout, data organization, and how software interacts with the hardware running it.",
          "Just as importantly, the experience reinforced the value of collaboration and humility. Some of my greatest opportunities to learn came from working with people whose expertise differed from my own, being open to feedback, and recognizing when someone else had a better approach. I became more comfortable working across disciplines, translating between technical and creative perspectives to help bring ideas to life.",
          "And perhaps most importantly, PANIC reminded me why I find augmented reality so exciting. There's something remarkable about creating characters and experiences that inhabit the same physical spaces we do. It's a medium that continues to change how I think about games, interaction, and the world around me.",
        ],
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
