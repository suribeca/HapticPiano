import usocket
s = usocket.socket()
s.connect(("192.168.4.16", 1883))
print("Conexión TCP exitosa")
