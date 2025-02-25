settings.init.allow_root.set(true)

# Define the playlist and ensure it plays in order
playlist = playlist("/root/djpanel_backend/playlist.m3u", mode="normal", reload_mode="watch")

# Define a fallback song
fallback_song = single("/root/djpanel_backend/public/upload/songs/03 God is Real-1713146659719.mp3")

# Use a fallback source combining the playlist and fallback song
radio = fallback(track_sensitive=true, [playlist, fallback_song])

# Stream to Icecast server with specified parameters
output.icecast(
  %mp3(bitrate=128),
  host = "icecast.hgdjlive.com",
  port = 8000,
  password = "hgdjpanel",
  mount = "/655347b59c00a7409d9181c3",
  radio
)