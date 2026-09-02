import { createRoot } from "react-dom/client";
import { App } from "./app";
import { installCourseAuth } from "./course-auth";
import "./styles.css";

installCourseAuth();
createRoot(document.getElementById("app")!).render(<App />);
