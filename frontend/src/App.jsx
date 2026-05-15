import { BrowserRouter, Routes, Route } from "react-router-dom";

import StartForm from "./pages/EntryForm";
import Instructions from "./pages/Instructions";
import Questions from "./pages/Questions";
import ThankYou from "./pages/ThankYou";

function App() {
  return (
    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<StartForm />}
        />

        <Route
          path="/instructions"
          element={<Instructions />}
        />

        <Route
          path="/questions"
          element={<Questions />}
        />

        <Route
          path="/thankyou"
          element={<ThankYou />}
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;