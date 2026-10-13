import { useState, useEffect } from "react";
import LoadingScreen from "./components/LoadingScreen";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import SelectedWorks, { Project } from "./components/SelectedWorks";
import Journal, { JournalArticle } from "./components/Journal";
import Explorations, { ExplorationItem } from "./components/Explorations";
import Stats from "./components/Stats";
import ContactFooter from "./components/ContactFooter";
import ProjectModal from "./components/ProjectModal";
import ExplorationModal from "./components/ExplorationModal";
import ArticleModal from "./components/ArticleModal";
import ResumeModal from "./components/ResumeModal";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("home");

  // Modals state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedExploration, setSelectedExploration] =
    useState<ExplorationItem | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<JournalArticle | null>(
    null
  );
  const [isResumeOpen, setIsResumeOpen] = useState(false);

  // Active section tracking on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const sections = ["home", "work", "journal", "explorations", "contact"];

      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 250 && rect.bottom >= 250) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setActiveSection("home");
  };

  return (
    <div className="relative min-h-screen bg-bg text-text-primary selection:bg-[#4E85BF] selection:text-white">
      {/* Section 1: Loading Screen */}
      {isLoading && <LoadingScreen onComplete={() => setIsLoading(false)} />}

      {/* Navbar fixed floating pill */}
      <Navbar
        activeSection={activeSection}
        onNavigate={scrollToSection}
        onOpenResume={() => setIsResumeOpen(true)}
        onOpenContact={() => scrollToSection("contact")}
      />

      <main>
        {/* Section 2: Hero */}
        <Hero
          onSeeWorks={() => scrollToSection("work")}
          onReachOut={() => scrollToSection("contact")}
        />

        {/* Section 3: Selected Works */}
        <SelectedWorks
          onSelectProject={(project) => setSelectedProject(project)}
          onViewAllWork={() => scrollToSection("explorations")}
        />

        {/* Section 4: Journal */}
        <Journal
          onSelectArticle={(article) => setSelectedArticle(article)}
          onViewAllThoughts={() => {
            const first = document.getElementById("journal");
            if (first) first.scrollIntoView({ behavior: "smooth" });
          }}
        />

        {/* Section 5: Explorations (Parallax Gallery) */}
        <Explorations
          onSelectItem={(item) => setSelectedExploration(item)}
          onOpenDribbble={() => {
            window.open("https://dribbble.com", "_blank", "noreferrer");
          }}
        />

        {/* Section 6: Stats */}
        <Stats />

        {/* Section 7: Contact / Footer */}
        <ContactFooter onScrollToTop={handleScrollToTop} />
      </main>

      {/* Interactive Lightboxes & Modals */}
      <ProjectModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />

      <ExplorationModal
        item={selectedExploration}
        onClose={() => setSelectedExploration(null)}
      />

      <ArticleModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />

      <ResumeModal
        isOpen={isResumeOpen}
        onClose={() => setIsResumeOpen(false)}
      />
    </div>
  );
}
