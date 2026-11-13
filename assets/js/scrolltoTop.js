document.addEventListener("DOMContentLoaded", () => {
  const target = document.querySelector(".search");
  const scrollToTopBtn = document.querySelector(".scrollToTopBtn");

  // Prevent script execution if the button or target element doesn't exist on the page
  if (!scrollToTopBtn || !target) return;

  // Smooth scroll handler
  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  scrollToTopBtn.addEventListener("click", scrollToTop);

  // IntersectionObserver callback
function callback(entries) {
  entries.forEach((entry) => {
    console.log("Is target intersecting?", entry.isIntersecting);
    if (entry.isIntersecting) {
      scrollToTopBtn.classList.remove("showBtn");
    } else {
      scrollToTopBtn.classList.add("showBtn");
    }
  });
}

  // Configuration: trigger when target is fully out of view
    const observerOptions = {
    root: null,
    // Triggers exit as soon as .filters passes the top of the viewport
    rootMargin: "0px 0px 0px 0px",
    threshold: 0
    };

  const observer = new IntersectionObserver(callback, observerOptions);
  observer.observe(target);
});