document.getElementById("patientForm").addEventListener("submit", function(e) {
  e.preventDefault();
  alert(" Patient Registered Successfully!");
});

document.getElementById("appointmentForm").addEventListener("submit", function(e) {
  e.preventDefault();
  alert(" Appointment Booked Successfully!");
});

document.getElementById("billingForm").addEventListener("submit", function(e) {
  e.preventDefault();
  alert(" Bill Generated Successfully!");
});
