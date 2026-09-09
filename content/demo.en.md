+++
title = "Demo"
description = "Two neural networks written by hand in JavaScript: one watches a sensor and flags anomalies, the other recognises a digit you draw."
template = "demo.html"

[extra]
eyebrow = "Demo"
heading = "Two neural networks, written by hand"
intro = "Both demos run entirely inside your browser. No data is sent anywhere, no learning library is loaded: the forward pass and backpropagation are written by hand in the two JavaScript files of this page."

monitor_eyebrow = "01 · Anomaly detection"
monitor_title = "Monitoring a machine that has never broken down"
monitor_body = "A vibration sensor streams a reading continuously. When the page loads, an autoencoder learns to reconstruct a forty-reading window of normal operation, then sets its own alert threshold on normal windows it has never seen. In service, the gap between the real signal and its reconstruction is the score. Trigger an incident with the buttons: the score breaks away as soon as the signal leaves the regime it learned, including while a drift is still invisible to the eye."
monitor_note = "The model has never seen a failure: it was only ever shown normal operation. That is what makes the approach usable in industry, where faults are rare, almost never labelled, and seldom twice the same."

digit_eyebrow = "02 · Digit recognition"
digit_title = "Draw a digit"
digit_body = "Sketch a digit from 0 to 9 inside the frame. The stroke is cropped, resized and recentred on its centre of mass (exactly the preprocessing of the MNIST dataset), then handed to a multilayer perceptron trained offline. The weights were quantised to 8 bits so they fit in a light file."
digit_note = "The model has never seen a mouse stroke, only scanned handwritten digits. A very thin line, a very thick one, or one stuck to the edge of the frame throws it off: that is instructive in itself."
+++
