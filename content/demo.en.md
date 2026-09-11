+++
title = "Demo"
description = "Two models to try in your browser: one watches a machine and flags anomalies, the other reads a digit you write by hand."
template = "demo.html"

[extra]
eyebrow = "Demo"
heading = "Two models, to try right away"
intro = "Both demos run entirely on your own computer: nothing you do here leaves for the internet. And nothing is borrowed from a ready-made library, everything that learns and decides on this page was written for it."

monitor_eyebrow = "01 · Anomaly detection"
monitor_title = "Monitoring a machine that has never broken down"
monitor_body = "A machine carries a sensor that streams a reading continuously. When the page loads, the model learns what a healthy machine looks like: it trains itself to redraw the last forty readings, and sets on its own the limit beyond which it considers that something is off. Trigger a failure with the buttons: it can no longer redraw what it sees, the gap grows, and the alert fires, sometimes before the problem is visible to the eye."
monitor_note = "The model has never seen a failure: it was only ever shown machines in good health. That is what makes the method usable in a factory, where breakdowns are rare, poorly documented, and seldom twice the same."

digit_eyebrow = "02 · Digit recognition"
digit_title = "Draw a digit"
digit_body = "Sketch a digit from 0 to 9 inside the frame. Your drawing is reduced to a small image 28 pixels across, cropped and recentred exactly like the ones the model learned from, then shown to it. On the right: what it sees, what it answers, and how sure it is."
digit_note = "The model has never seen a mouse stroke, only digits written with a pen and then scanned. A very thin line, a very thick one, or one stuck to the edge of the frame throws it off, and that is instructive: a model is only worth anything on data that resembles what it learned from."
+++
