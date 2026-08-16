# vendor/biryuzik.js — bundled copy of the shared pet engine

DO NOT EDIT HERE. Source of truth: `donosov999-ai/mascot-engine`, file `apps/web/biryuzik.js`.
Make changes there, then refresh this copy:

    cp ~/dev/mascot-engine/apps/web/biryuzik.js src/app/vendor/biryuzik.js

WHY A COPY when the engine is already served from the channel. The app must work with no
network — on a plane, in a tunnel, or when the channel itself is down. `shared-engine.js` loads
THIS copy first, and only then, if the network is reachable, layers a fresher build on top.
The reverse order would leave an offline user with no pet at all.
