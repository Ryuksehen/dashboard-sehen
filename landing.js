function ponerAnioActual() {
  const anio = new Date().getFullYear();
  const etiqueta = document.getElementById("anio-actual");
  if (etiqueta) etiqueta.textContent = "Todos los derechos reservados " + anio;
}

function activarBotonesPlan() {
  const botones = document.querySelectorAll(".btn-plan");

  botones.forEach(function(boton) {
    boton.addEventListener("click", function() {
      const plan = boton.dataset.plan || "Plan";
      const telefono = "573000000000";
      const mensaje = "Hola, quiero activar la licencia " + plan + " de VHO Gaming.";
      const url = "https://wa.me/" + telefono + "?text=" + encodeURIComponent(mensaje);
      window.open(url, "_blank", "noopener");
    });
  });
}

function activarRevelado() {
  const elementos = document.querySelectorAll(".revelar");
  if (!("IntersectionObserver" in window)) {
    elementos.forEach(function(item) {
      item.classList.add("visible");
    });
    return;
  }

  const observador = new IntersectionObserver(function(entradas) {
    entradas.forEach(function(entrada) {
      if (entrada.isIntersecting) {
        entrada.target.classList.add("visible");
        observador.unobserve(entrada.target);
      }
    });
  }, { threshold: 0.2 });

  elementos.forEach(function(item) {
    observador.observe(item);
  });
}

document.addEventListener("DOMContentLoaded", function() {
  ponerAnioActual();
  activarBotonesPlan();
  activarRevelado();
});
