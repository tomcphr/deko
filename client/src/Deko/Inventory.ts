export class Inventory
{
    socket: SocketIOClient.Socket;
    username: string;

    constructor (socket: SocketIOClient.Socket, username: string)
    {
        this.socket = socket;

        this.username = username;
    }

    open ()
    {
        $("#inventoryDialog").dialog({
            title: "Inventory",
            appendTo: "#gameContainer",
            resizable: false,
            height: 300,
            width: 400,
            close: function () {
                $(".inventoryItem").remove();
            }
        });
        $("#inventoryDialog").dialog("widget").draggable("option", "containment", "#gameContainer");
        $(window).resize(function() {
            $("#inventoryDialog").dialog("option", "position", {my: "center", at: "center", of: window});
        });

        this.populateInventory();
    }

    populateInventory ()
    {
        this.socket.emit("getItems", this.username, function (type, message) {
            switch (type) {
                case "data":
                    for (var data in message) {
                        var item = message[data];

                        var template = {
                            "name"            :     "Item",
                            "description"     :     "Item Description",
                            "quantity"        :     "1",
                        };
                        for (var property in template) {
                            template[property] = item[property];
                        }

                        var name = $("<div>", {
                            "class"    :     "itemDetail",
                            "title"    :     template.description
                        }).html(template.name);

                        var quantity = $("<div>", {
                            "class"    :     "itemDetail",
                            "style"    :     "text-align: right;",
                        }).html(template.quantity);

                        var row = $("<div class='itemRow inventoryItem fullWidth'>");
                        row.append(name);
                        row.append(quantity);

                        $("#inventoryItems").append(row);

                        $("#inventoryItems").append($("<hr>", {
                            "class"    :     "itemSplit inventoryItem",
                        }));
                    }
                    break;

                case "error":
                    var div = $("<div>", {
                        "class"    :     "inventoryItem textCenter ui-state-error ui-corner-all",
                    });
                    div.append(message);

                    $("#inventoryItems").append(div);
                    break;

                default:
                    var div = $("<div>", {
                        "class"    :     "inventoryItem textCenter ui-state-error ui-corner-all",
                    });
                    div.append("Something has gone wrong");

                    $("#inventoryItems").append(div);
                    break;
            }
        });
    }
}