# IPA-dhcp

This is a rudimentary plugin that adds DHCP functionality to [FreeIPA](http://www.freeipa.org).

This plugin can be used in one of two ways. If you want, you can install [ISC DHCP](https://www.isc.org/downloads/dhcp/) on your FreeIPA server itself and let your FreeIPA server act as a DHCP server; this approximately mirrors the way FreeIPA can run ISC BIND and act as a DNS server. Or if you prefer you can run ISC DHCP on another, separate server and point it at your FreeIPA server via an anonymous LDAP binding. Both methods are really exactly the same; the only difference is where you install and run the ISC DHCP software.

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

## Other obvious areas for improvement

There are some pretty obvious low-hanging fruit that I haven't bothered to pluck.

### Shared networks

ISC DHCP includes this concept called a "shared network," which is a topology in which multiple disjoint IP networks exist on the same physical network — where "physical network" here includes _logical_ networks like VLANs. It's a pretty rarefied idea, really. It boils down to the idea that on a single broadcast domain you might have devices in the 172.16.1.0/24 network _and also_ devices in the 172.16.2.0/24 network … again, _on a single broadcast domain._ Not on separate segments connected by a router, not on separate sets of ports belonging to different VLANs, but _all on the same switch_ for some reason. I'm sure there are people out there who use this kind of topology and probably for good reason, but in all my years I've never actually seen it deployed, so I've not bothered to add support for it into this plugin.

### Groups and classes

Groups and classes are labor-saving devices in the DHCP config file, basically. They're data structures that let you assign different parameters to hosts automatically rather than having to create a large, complex config file with a lot of copying and pasting. You can put a set of hosts under a group in order to give them some common options, or you can set up a class so hosts sharing common characteristics get the right options automatically.

I'm not using groups or classes, so I haven't added any support for them. It's really that simple.

### Failover

If I'm not mistaken, there's _no_ special LDAP support for DHCP failover in ISC DHCP 4.2.5, meaning it would all have to be configured using `dhcpStatements` and such. I haven't taken the time to do this, though I probably will eventually.
