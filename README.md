# IPA-dhcp

This is a rudimentary plugin that adds DHCP functionality to [FreeIPA](http://www.freeipa.org).

This plugin can be used in one of two ways. If you want, you can install [ISC DHCP](https://www.isc.org/downloads/dhcp/) on your FreeIPA server itself and let your FreeIPA server act as a DHCP server; this approximately mirrors the way FreeIPA can run ISC BIND and act as a DNS server. Or if you prefer you can run ISC DHCP on another, separate server and point it at your FreeIPA server via an anonymous LDAP binding. Both methods are really exactly the same; the only difference is where you install and run the ISC DHCP software.

## Pictures

<center><a href="http://i.imgur.com/Q0hTeDu.png"><img width="200px" src="http://i.imgur.com/Q0hTeDu.png"></a> <a href="http://i.imgur.com/uczre41.png"><img width="200px" src="http://i.imgur.com/uczre41.png"></a> <a href="http://i.imgur.com/aNAkxwd.png"><img width="200px" img src="http://i.imgur.com/aNAkxwd.png"></a> <a href="http://i.imgur.com/ClkYgzy.png"><img width="200px" img src="http://i.imgur.com/ClkYgzy.png"></a> <a href="http://i.imgur.com/ysmKgXL.png"><img width="200px" img src="http://i.imgur.com/ysmKgXL.png"></a> <a href="http://i.imgur.com/IALwjJU.png"><img width="200px" img src="http://i.imgur.com/IALwjJU.png"></a> <a href="http://i.imgur.com/HeqlaoQ.png"><img width="200px" img src="http://i.imgur.com/HeqlaoQ.png"></a></center>

## An important caveat

This plugin was built to purpose. It's not a totally general-purpose solution for DHCP integration into FreeIPA. Some major features of ISC DHCP are currently not supported at all by this plugin, including shared networks, classes and DHCP failover. It's not that those features _can't_ be supported; it's just that I don't personally need them right now, so I haven't added them. So it might be better to think of this plugin as a sort of proof of concept, or maybe a reference implementation of the DHCP schema, rather than a piece of finished software for general use.

That being said, you, Constant Reader, are welcome to this software. If you can use it as is, great. If not but it's useful to you as a springboard toward your own solution, also great. Either way, welcome and good luck.

## How it works in a nutshell

The DHCP LDAP schema is, let's say, not necessarily the easiest thing in the world to work with, and its implementation in ISC DHCP is incomplete. So I've chosen to take a fairly minimalist approach to this plugin.

This plugin supports a single, global configuration rooted at `cn=dhcp,$SUFFIX`. That's the `dhcpService` object. It has a handful of global attributes, and it also has links to the `dhcpServer` objects that identify the DHCP server hosts that get their configuration from this server.

Beneath `cn=dhcp` there are `dhcpSubnet` objects, one for each — surprise — subnet the DHCP server services. If the server receives a DHCP request from a device on a particular subnet, it will respond to that request if and only if there's a `dhcpSubnet` object in the tree that corresponds to that subnet. If there's no `dhcpSubnet` object, the server will ignore all requests from that subnet.

Each `dhcpSubnet` may have one or more `dhcpPool` objects under it. A `dhcpPool` has a range attribute that sets the first and last IP address in the pool; the DHCP server will draw from the IPs in that range when handing out dynamic leases.

And then there's the labor-saving part, the part which I personally find most useful but which I can imagine most people will find least appealing: Any "host" in the IPA database which has both a MAC address and an A record gets a `dhcpHost` object generated for it automatically and dynamically. This is _why_ I wrote this plugin in the first place. In my environment, I want every device in the system to be able to get its IP address via DHCP (as long as it's plugged into the correct switch port). Most people probably don't want that, or at least not _exactly_ that. But that's what I want, so that's what I wrote.

It would, of course, be possible to change the plugin such that `dhcpHost` objects aren't dynamic but rather are generated statically, giving the user the option of creating a `dhcpHost` from an existing host record, then making the `dhcpHost` records editable in the UI in much the same way that DNS records already are. That would be, as the saying goes, a "simple matter of programming."

## How to use it

Once you've configured the plugin how you like, either via the IPA command line (start with `ipa help dhcp` and go from there) or via the web GUI, you need to configure an ISC DHCP server to talk to it. Install the server software by doing a 

```
yum install -y dhcp
```

to get what you need (assuming you're using Red Hat Enterprise Linux or CentOS; details will differ if you're on Fedora). Once the server is installed, edit the file `/etc/dhcp/dhcpd.conf` and make it look like this:

```
ldap-server "ipa.example.com";
ldap-port 389;
ldap-base-dn "cn=dhcp,dc=example,dc=com";
ldap-method static;
ldap-debug-file "/var/log/dhcp-ldap-startup.log";
```

Obviously the hostname `ipa.example.com` should instead be the hostname of your FreeIPA server, and the base DN suffix `dc=example,dc=com` should instead be your own base DN suffix. But other than that, make your config file look like this; this sets up an anonymous bind to the FreeIPA LDAP server.

To test out the configuration, as root on your DHCP server, run the following command:

```
dhcpd -d
```

You should get something like this (with your own MAC and IP address, obviously):

```
Internet Systems Consortium DHCP Server 4.2.5
Copyright 2004-2013 Internet Systems Consortium.
All rights reserved.
For info, please visit https://www.isc.org/software/dhcp/
Wrote 0 deleted host decls to leases file.
Wrote 0 new dynamic host decls to leases file.
Wrote 0 leases to leases file.
Listening on LPF/eth0/00:50:56:1e:01:1f/10.30.1.0/24
Sending on   LPF/eth0/00:50:56:1e:01:1f/10.30.1.0/24
Sending on   Socket/fallback/fallback-net
```

If you get any error messages, check your DHCP configuration in FreeIPA and try again. Assuming DHCPd started up correctly, hit control-C to stop it and then check the contents of `/var/log/dhcp-ldap-startup.log`. Modulo some awkward line breaks, this file should look like a dhcpd.conf file, something like this:

```
authoritative;
default-lease-time 43200;
max-lease-time 86400;
one-lease-per-client on;
option domain-name-servers ns.la.charlietango.com;
option domain-name "la.charlietango.com";
option domain-search "la.charlietango.com", "charlietango.com";

host mac1.la.charlietango.com {
    hardware ethernet 01:02:03:04:05:06;
    fixed-address mac1.la.charlietango.com;
    option host-name "mac1.la.charlietango.com";
}

subnet 10.30.1.0 netmask 255.255.255.0 {
    option broadcast-address 10.30.1.255;
    option subnet-mask 255.255.255.0;
    option routers 10.30.1.254;
    pool {
        range 10.30.1.201 10.30.1.249;
        allow known-clients;
        allow unknown-clients;
        max-lease-time 86400;
        default-lease-time 43200;
    }
}
```

I've fixed the line breaks and indentation to make it more readable, but other than that, that's what DHCPd generated for me based on the configuration I created in my FreeIPA server. Note that I have one host in FreeIPA that has a MAC address (the obviously bogus `01:02:03:04:05:06`) and an IP address; this was automatically turned into a global DHCP host record. Below that, you see my one DHCP subnet containing its single address pool.

Now, to get this config generated I set my DHCP server's `ldap-method` to `static`. This is great for testing but _not_ for production. See, when `ldap-method` is set to `static` the DHCP server queries the LDAP server _once_ at start-up, downloads the whole tree, converts that tree into a running configuration and then _never talks to the LDAP server again_ until DHCPd is restarted. This stinks because you have to restart DHCPd every time you add a host to the realm! It's better by far to set `ldap-method` to `dynamic`. This tells DHCPd to read its _static_ configuration once at startup, but whenever a request comes in for a lease to query the LDAP server anew. Changes to the LDAP configuration, then, can propagate to the DHCP server(s) without having to restart them.

So for production, make your `dhcpd.conf` look like this:

```
ldap-server "ipa.example.com";
ldap-port 389;
ldap-base-dn "cn=dhcp,dc=example,dc=com";
ldap-method dynamic;
ldap-debug-file "/var/log/dhcp-ldap-startup.log";
```

The `ldap-debug-file` line remains optional. If you leave it in and start up DHCPd, this time you'll get a config that looks like this:

```
authoritative;
default-lease-time 43200;
max-lease-time 86400;
one-lease-per-client on;
option domain-name-servers ns.la.charlietango.com;
option domain-name "la.charlietango.com";
option domain-search "la.charlietango.com", "charlietango.com";

subnet 10.30.1.0 netmask 255.255.255.0 {
    option broadcast-address 10.30.1.255;
    option subnet-mask 255.255.255.0;
    option routers 10.30.1.254;
    pool {
        range 10.30.1.201 10.30.1.249;
        allow known-clients;
        allow unknown-clients;
        max-lease-time 86400;
        default-lease-time 43200;
    }
}
```

Notice that this looks just the same as before, only the host entry isn't there. DHCPd will query the LDAP server for `dhcpHost` objects every time a DHCP request comes in … which, if you have a big, busy network with a lot of DHCP requests, can put some load on your LDAP server. But this can be addressed with replication, so it's rarely a real issue.

## Areas for improvement

There are some pretty obvious low-hanging fruit that I haven't bothered to pluck.

### Shared networks

ISC DHCP includes this concept called a "shared network," which is a topology in which multiple disjoint IP networks exist on the same physical network — where "physical network" here includes _logical_ networks like VLANs. It's a pretty rarefied idea, really. It boils down to the idea that on a single broadcast domain you might have devices in the 172.16.1.0/24 network _and also_ devices in the 172.16.2.0/24 network … again, _on a single broadcast domain._ Not on separate segments connected by a router, not on separate sets of ports belonging to different VLANs, but _all on the same switch_ for some reason. I'm sure there are people out there who use this kind of topology and probably for good reason, but in all my years I've never actually seen it deployed, so I've not bothered to add support for it into this plugin.

### Groups and classes

Groups and classes are labor-saving devices in the DHCP config file, basically. They're data structures that let you assign different parameters to hosts automatically rather than having to create a large, complex config file with a lot of copying and pasting. You can put a set of hosts under a group in order to give them some common options, or you can set up a class so hosts sharing common characteristics get the right options automatically.

I'm not using groups or classes, so I haven't added any support for them. It's really that simple.

### Failover

If I'm not mistaken, there's _no_ special LDAP support for DHCP failover in ISC DHCP 4.2.5, meaning it would all have to be configured using `dhcpStatements` and such. I haven't taken the time to do this, though I probably will eventually.
