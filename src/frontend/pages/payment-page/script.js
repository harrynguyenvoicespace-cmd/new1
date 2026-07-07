const billingButtons = Array.from(document.querySelectorAll(".billing-option"));
const priceValues = Array.from(document.querySelectorAll(".price-row strong"));
const priceMetas = Array.from(document.querySelectorAll(".price-meta"));

function setBillingPeriod(period) {
  const isYearly = period === "yearly";

  billingButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.period === period);
  });

  priceValues.forEach((price) => {
    price.textContent = price.dataset[period] || "0";
  });

  priceMetas.forEach((meta) => {
    meta.innerHTML = isYearly ? "USD /<br>year" : "USD /<br>month";
  });
}

billingButtons.forEach((button) => {
  button.addEventListener("click", () => setBillingPeriod(button.dataset.period));
});

if (location.pathname.toLowerCase().includes("studio") && !location.hash) {
  history.replaceState(null, "", "/#studio");
}
